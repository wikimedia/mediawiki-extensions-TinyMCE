/**
 * TinyMCE extension
 *
 * Parses wikicode to HTML and vice versa, enabling it to be edited by TinyMCE
 *
 * @author     Markus Glaser <glaser@hallowelt.com>
 * @author     Sebastian Ulbricht
 * @author     Duncan Crane <duncan.crane@aoxomoxoa.co.uk>
 * @copyright  Copyright (C) 2016 Hallo Welt! GmbH, All rights reserved.
 * @license    http://www.gnu.org/copyleft/gpl.html GNU Public License v2 or later
 * @filesource
 */

(function (domGlobals) {
	"use strict";

	/**
	 *
	 * definition of variables used 
	 * globally in this plugin
	 * @type Array
	 */
		/**
		 * global variable that contains the editor instance
		 * @type TinyMCE
		 */
		var	editor = tinymce.activeEditor;

		/**
		 *
		 * Utility functions used in this plugin and others
		 * @type String
		 */
		var utility = editor.getParam("wiki_utility");

		/**
		 *
		 * set up utility functions used  
		 * in this plugin
		 * 
		 */
	
		var setContent = utility.setContent;
	
		var setSelection = utility.setSelection;
	
		var getContent = utility.getContent;
	
		var getSelection = utility.getSelection;
	
		var htmlEncode = utility.htmlEncode;
	
		var htmlDecode = utility.htmlDecode;
	
		var createUniqueNumber = utility.createUniqueNumber;
	
		var doUpload = utility.doUpload;
	
		var checkUploadDetail = utility.checkUploadDetail;
	
		var translate = utility.translate;

		var debug = utility.debug;

		/**
		 *
		 * Flags if html entities need to be decoded on the input
		 * @type String
		 */
		var _decodeHtmlEntitiesOnInput = editor.getParam("decodeHtmlEntitiesOnInput");

		/**
		 *
		 * Points to the mediawiki API for this wiki
		 * @type String
		 */
		var _mwtWikiApi = editor.getParam("wiki_api_path"),

		/**
		 *
		 * Points to the title of the mediawiki page to be accessed by API
		 * @type String
		 */
		_mwtPageTitle = editor.getParam("wiki_page_mwtPageTitle"),

		/**
		 *
		 * allowable url protocols defined in wiki
		 * @type Array
		 */
		_mwtUrlProtocols = editor.getParam("wiki_url_protocols"),

		/**
		 *
		 * allowable namespace ID's, defined by wiki
		 * @type Array
		 */
		_mwtNamespaces = editor.getParam("wiki_namespaces"),

		/**
		 *
		 * local name of the 'file' namespace
		 * @type Array
		 */
		_mwtFileNamespace = editor.getParam("wiki_fileNamespace"),

		/**
		 *
		 * allowable extension tags, defined by wiki
		 * @type Array
		 */
		_mwtExtensionTagsList = editor.getParam("wiki_extension_tags_list"),

		/**
		 *
		 * allowable tags html tags, defined in MW_tinymce.js
		 * @type Array
		 */
		_mwtPreservedTagsList = editor.getParam("wiki_preserved_tags_list"),

		/**
		 *
		 * allowable tags that form html blocks, defined in MW_tinymce.js
		 * @type Array
		 */
		_mwtBlockTagsList = editor.getParam("wiki_block_tags"),

		/**
		 *
		 * allowable tags that are processed identically by mediawiki
		 * and html bowser, defined in MW_tinymce.js
		 * @type Array
		 */
		_mwtInvariantTagsList = editor.getParam("wiki_invariant_tags"),

		/**
		 *
		 * tags which have a wiki equivalent that we want to preserve in 
		 * the wiki text, defined in MW_tinymce.js
		 * @type Array
		 */
		_mwtPreservedHtmlTagsList = editor.getParam("wiki_preserved_html_tags"),

		/**
		 *
		 * classes used to identify edit part of a template.  If this is so the pipe
		 * characters are converted to {{!}} unless they are part of a template call themselves
		 * @type Array
		 */
		_mwtTemplateClasses = editor.getParam("wiki_template_classes"),

		/**
		 *
		 * flags used to determine which debug logs are active
		 * @type Array
		 */
		_mwtDebugFlags = editor.getParam("tinyMCEDebugFlags"),

		/**
		 *
		 * classes used to identify plain text elements.  
		 * @type Array
		 */
		_mwtPlainTextTagsBlock = editor.getParam("wiki_plain_text_tags_block"),
		_mwtPlainTextTagsInLine = editor.getParam("wiki_plain_text_tags_inline"),
		_mwtPlainTextTags = _mwtPlainTextTagsBlock.concat(_mwtPlainTextTagsInLine),
		_mwtPlainTextClassesBlock = ('mwt-' + _mwtPlainTextTagsBlock.join(",mwt-")).split(","),
		_mwtPlainTextClassesInLine = ('mwt-' + _mwtPlainTextTagsInLine.join(",mwt-")).split(","),
		_mwtPlainTextClasses = _mwtPlainTextClassesBlock.concat(_mwtPlainTextClassesInLine),

		/**
		 *
		 * classes used to identify edit part of a template.  If this is so the pipe
		 * characters are converted to {{!}} unless they are part of a template call themselves
		 * @type Array
		 */
		_mwtPlainTextTagsCommands = editor.getParam("wiki_plain_text_tags_allowed_commands"),

		/**
		 *
		 * Flag used for toggling visible placeholders on or off and
		 * variable containing initial class value for the placeholders
		 *
		 */
		_showPlaceholders = editor.getParam("showPlaceholders"),
		_placeholderClass = _showPlaceholders ? "mwt-showPlaceholder" : "mwt-hidePlaceholder",

		/**
		 *
		 * global used to store the form of pipe used in the original wikicode
		 * Set to '{{!}}' or '|' depending on whether the target text is in
		 * a template or not
		 * default '|'
		 * @type String
		 */
		_pipeText,

		/**
		 *
		 * span for inserting a placeholder in editor text for 
		 * non-rendering new lines in the wiki code.  The character
		 * displayed is defined in MW_tinymce.css
		 * @type String
		 */
		_slb = 
			'<span class="mwt-placeHolder mwt-singleLinebreak mwt-slb' 
			+ (editor.getParam("directionality")) + ' ' + _placeholderClass 
			+ '" title="'
			+ translate('tinymce-wikicode-non-rendering-single-linebreak' )
			+ '" draggable="true" contenteditable="false">' + '&thinsp;'
			+ '</span>',

		/**
		 *
		 * span for inserting a placeholder in editor text for 
		 * switches in the wiki code.  The character
		 * displayed is defined in MW_tinymce.css 
		 * @type String
		 */
		_swt = 
			'<span class="mwt-mwt-placeHolder mwt-switch '  + _placeholderClass
			+ '" draggable="true" contenteditable="false">' + '&thinsp;'
			+ '</span>',

		/**
		 *
		 * span for inserting a placeholder in editor text for 
		 * non-rendering mediawiki parser output in the wiki code.  
		 * The character displayed is defined in MW_tinymce.css 
		 * @type String
		 */
		_nrw = 
			'<span class="mwt-placeHolder mwt-emptyOutput '  + _placeholderClass
			+ '" draggable="true" contenteditable="false">' + '&thinsp;'
			+ '</span>',

		/**
		 *
		 * span for inserting a placeholder in editor text for 
		 * non-breaking spaces.  
		 * The character displayed is defined in MW_tinymce.css 
		 * @type String
		 */
		_nbs = 
			'<span class="mwt-placeHolder  mwt-nonBreakingSpace '  + _placeholderClass
			+ '" draggable="true" contenteditable="false" title="&amp;nbsp;" >' + '&nbsp;'
			+ '</span>',

		/**
		 *
		 * span for inserting a placeholder in editor text for 
		 * '<'.  
		 * The character displayed is defined in MW_tinymce.css 
		 * @type String
		 */
		_lte = 
			'<span class="mwt-editable mwt-wikiMagic mwt-placeholder mwt-htmlEntity"'
			+ ' data-mwt-wikitext="&amp;lt;"'
			+ ' draggable="true" contenteditable="false" title="&amp;lt;" >&lt;</span>',

		/**
		 *
		 * span for inserting a placeholder in editor text for 
		 * '&'.  
		 * @type String
		 */
		_ampamp = 
			'<span class="mwt-editable mwt-wikiMagic mwt-placeholder mwt-htmlEntity"'
			+ ' data-mwt-wikitext="&amp;amp;amp;amp;"'
			+ ' draggable="true" contenteditable="false" title="&amp;amp;" >&</span>',

		/**
		 *
		 * span for inserting a placeholder in editor text for 
		 * '>'.  
		 * @type String
		 */
		_gte = 
			'<span class="mwt-editable mwt-wikiMagic mwt-placeholder mwt-htmlEntity"'
			+ ' data-mwt-wikitext="&amp;gt;"'
			+ ' draggable="true" contenteditable="false" title="&amp;gt;" >&gt;</span>',

		/**
		 *
		 * span for inserting a placeholder in editor text for 
		 * two new line paragraph start  
		 * @type String
		 */
		_elf = 
			'<br class="mwt-emptylineFirst">',

		/**
		 *
		 * span for inserting a placeholder in editor text for 
		 * single new line.  
		 * @type String
		 */
		_enl = 
			'<br class="mwt-emptyline">',

		/**
		 *
		 * array to store html snippets and placeholders for each.
		 * The paceholders are used during the conversion between
		 * html and wikicode and vice a versa to avoid converting
		 * code that has already been converted!
		 * @type Array
		 */
		_tags4Html = new Array(),

		/**
		 *
		 * array to store wikicode snippets and placeholders for each.
		 * The paceholders are used during the conversion between
		 * html and wikicode and vice a versa to avoid converting
		 * code that has already been converted!
		 * @type Array
		 */
		_tags4Wiki = new Array();

	var pluginManager = tinymce.util.Tools.resolve('tinymce.PluginManager');

	/**
	 * Ensures text conforms to TinyMCE schema including any changes
	 * to the valid elements
	 *
	 * @param {String} text
	 * @returns {String}
	 */
	function _sanitize( text, validate ) {
		var serializer = new tinymce.html.Serializer(),
			parser = new tinymce.html.DomParser({validate: validate}, editor.schema);

		if (text == '' ) return text;
		text = "<div class='tinywrapper'>" + text + "</div>";
		text = text.replace(/\n/gmi, '{@@vnl@@}');	
		text = serializer.serialize( parser.parse( text, { forced_root_block: false, context: editor.getBody() } ) );
		text = text.replace(/<p class="mwt-paragraph">{@@vnl@@}<\/p>/gmi, '\n');	
		text = text.replace(/{@@vnl@@}/gmi, '\n');	
		text = text.replace(/^<div class=('|")tinywrapper\1>([^]*)<\/div>$/m, '$2');	

		return text;
	}

	/**
	 * replace any wiki placeholders in the text with their 
	 * original wiki text
	 *
	 * @param {String} text
	 * @returns {String}
	 */
	function _recoverPlaceholders2Wiki (tagWikiText) {
		// sometimes the parameters have been &xxx; encoded.  We want
		// to decode these where they are applied to placeholders so
		// the replacement of placeholders that follows will work
			tagWikiText = tagWikiText.replace(/(\{@@@.*?:\d*@@@})/gmi, function(match, $1) {
				var wikiText = _tags4Wiki[$1];
				
				// if this is an html entity un-escape the & character
				if ( $1.match(/^{@@@HTMLENTITY:\d*@@@}$/)) wikiText = wikiText.replace(/&amp;/, '&');

				return wikiText;
			});
		return tagWikiText
	}

	/**
	 * replace any html placeholders in the text with their 
	 * original html text
	 *
	 * @param {String} text
	 * @returns {String}
	 */
	function _recoverPlaceholders2Html (tagHTML) {
		// sometimes the parameters have been &xxx; encoded.  We want
		// to decode these where they are applied to placeholders so
		// the replacement of placeholders that follows will work
			tagHTML = tagHTML.replace(/(\{@@@.*?:\d*@@@})/gmi, function(match, $1) {
				var html = _tags4Html[$1]
				
				return html;
			});
		return tagHTML
	}

	/**
	 * coverts wiki control codes (Tags, templates etc) to placeholders
	 * which are stored in the text being converted for recovery
	 * later.  Where the control code does not need to be parsed by the 
	 * wiki parser the dom element is created now, other wise it will be created later
	 * when all the control codes to be parsed are batched together for sending
	 * to the API
	 *
	 * @param {String} text
	 * @returns {String}
	 */
	function _getPlaceHolder4Html (tagWikiText, tagHTML, tagClass, protection) {
		var elementClass,
			displayTagWikiText = '',
			titleWikiText = '',
			tagOuterHTML = '',
			t,
			id,
			tagId,
			element;

		// recover any place holders already in the tagWikiText or
		// tagHTML to avoid them being embedded in the new place holder
		tagWikiText = _recoverPlaceholders2Wiki( tagWikiText );
		tagHTML = _recoverPlaceholders2Html( tagHTML );
		
		//  create id for new dom element, which wil also be the placeholder
		// temporarily inserted in the text to avoid conversion problems
		tagId = tagClass.toUpperCase() + ":" + createUniqueNumber();
		id = "{@@@" + tagId + "@@@}";

		if ( tagHTML != 'toParse' && protection == 'nonEditable' ) {
			if (  protection == 'nonEditable' ) {
				tagWikiText = tagWikiText.replace(/<span[^>]*class=('|")selectedcontent\1[^>]*>(.*?)<\/span>/gmi, "$2");
			}		

			// protect new lines
			displayTagWikiText = tagWikiText.replace( /\n/gi, '{@@nl@@}' );
	
			// replace any tag new line placeholders from the title
			titleWikiText = tagWikiText.replace(/{@@[bht]nl@@}/gmi, "\n");

			// if title starts with &amp;amp; then unescape it
			titleWikiText = tagWikiText.replace(/^&(amp;)*/gmi, "&");
	
			// make sure tagHTML is really HTML else will break when 
			// converting to DOM element.  If not wrap in <code> tags
			if ( !tagHTML.match(/^<.*>$/gmi) ) {
				tagHTML = '<code>' + tagHTML + '</code>';
			};

			// create DOM element from tagHTML
			element = $(tagHTML);							
			element.addClass("mwt-nonEditable mwt-wikiMagic mwt-placeholder mwt-" + tagClass);
			element.attr({
				'id': tagId,
				'title': titleWikiText ,
				'data-mwt-type': tagClass,
				'data-mwt-wikitext': displayTagWikiText,
				'draggable': "true",
				'contenteditable': "false"
			});

			tagOuterHTML = element.prop("outerHTML");

		} else {
			// the tagWikiText needs to be parsed so we 'batch' them for
			// to process later.  In this case tagHTML = 'toParse
			tagOuterHTML = tagHTML;		
		}

		// preserve the wiki text and html in arrays for later substitution
		// for the relevant placeholder
		_tags4Wiki[id] = tagWikiText;
		_tags4Html[id] = tagOuterHTML;

		return id;
	}

	/**
	 * creates a wiki link for an image and returns a place
	 * holder for the html text, which is substituted later
	 *
	 * @param {String} text
	 * @returns {String}
	 */
	function _getWikiImageLink(imageElm, imageLink) {
		var aLink,
			file,
			fileData,
			fileType,
			fileName,
			mimeType,
			extension,
			uploadDetails,
			uploadResult,
			ignoreWarnings = true,
			fileSummary = '',
			wikiImageObject = [],
			htmlImageObject = imageElm,
			attribute,
			attributes = imageElm.attributes,
			source = attributes['src'].value.split('#')[0].split('?')[0],
			sourceURI = attributes['src'].value,
			protocol = source.split('/')[0].toLowerCase(),
			dstName = decodeURI( source.split('/').pop().split('#')[0].split('?')[0] ),
			wikiText,
			stylestring,
			properties,
			style,
			stylearray = {},
			property,
			value,
			imageCaption,
			size,
			fileReader,
			thumbsizes = ['120', '150', '180', '200', '250', '300'],
			userThumbsize = thumbsizes[ mw.user ? mw.user.options.get('thumbsize') : 3 ];

		// return a file from the datat image
		function dataURLtoFile(fileData, filename, mime) {
			var bstr = atob( fileData ), 
			n = bstr.length, 
			u8arr = new Uint8Array(n);


			while(n--){
				u8arr[n] = bstr.charCodeAt(n);
			}
				return new File([u8arr], filename, {type:mime});
		}

		// determine if this is a local image or external
		if ((protocol == 'https:') || (protocol == 'http:')) {
			fileType = 'URL';
			uploadDetails = doUpload(fileType, sourceURI, dstName, fileSummary, ignoreWarnings);
			uploadResult = checkUploadDetail( editor, uploadDetails, ignoreWarnings, dstName);
		} else if (protocol == 'data:image') {
			fileType = 'File';
			mimeType = attributes[ 'src' ].value.split( ':' )[1].split( ';' )[0];
			extension = mimeType.split( '/' )[1];
			fileName = 'img' + createUniqueNumber() + '.' + extension;
			dstName = fileName;
			fileData = attributes['src'].value.split(',')[1];
			file = dataURLtoFile( fileData, fileName, mimeType )
			uploadDetails = doUpload( fileType, file, file.name, fileSummary, ignoreWarnings );
			uploadResult = checkUploadDetail( editor, uploadDetails, ignoreWarnings, file.name );
			wikiImageObject[ 'thumb' ] = "true";
		} else {
			// the image is base64 data so create a link as a placeholder with details
			fileType = 'File';
			dstName = 'data_image';
		}
		
		// abort if an error has been detected
		if ( uploadResult.state == "error" ) return '';

		// upload the image (or use existing image on wiki if already uploaded
		// checking the response and process any errors or warning appropriately
		// build the wiki code for the image link
		for (var j = 0; j < attributes.length; j++) {
			attribute = attributes[j].name;
			if ( !( attribute == 'width' || !attribute == 'height' )) {
				wikiImageObject[attribute] = attributes[j].value;
			}
		}

		// check if wikiImageObject.style is set
		// and then process the style attributes
		if (wikiImageObject.style) {
			stylestring = wikiImageObject.style;
			stylestring = stylestring.replace(/\s/g, "");
			properties = stylestring.split(';');
			stylearray = {};
			properties.forEach(function(property) {
				var option = property.split(':');
				stylearray[option[0]] = option [1];
			});
			stylestring = JSON.stringify(stylearray);
			style = JSON.parse(stylestring);
			if (style['display'] === 'block' &&
				style['margin-left'] === 'auto' &&
				style['margin-right'] === 'auto') {
				wikiImageObject.align = 'center';
			}
			if (style['width']) {
				var stylewidth = style['width'].replace('px', '');
				if ( stylewidth !== "0" ) {
					wikiImageObject.sizewidth = stylewidth ;
				}
			}
			if (style['height']) {
				var styleheight = style['height'].replace('px', '');
				if ( styleheight !== "0" ) {
					wikiImageObject.sizeheight = styleheight ;
				}
			}
			if (style['float']) {
				if (style['float'] === 'left') {
					wikiImageObject.left = true;
					wikiImageObject.align = 'left';
				} else if (style['float'] === 'right') {
					wikiImageObject.right = true;
					wikiImageObject.align = 'right';
				}
			}
			if (style['vertical-align']) {
				wikiImageObject.verticalalign = style['vertical-align'];
			}
		}

		// now process the image class if it has wiki formats
		if (wikiImageObject.class) {
			if (wikiImageObject.class.indexOf("thumbborder") >= 0) {
				wikiImageObject.border = "true";
			}
			if (wikiImageObject.class.indexOf("thumbimage") >= 0) {
				wikiImageObject.frame = "true";
			}
			if (wikiImageObject.class.indexOf("thumbthumb") >= 0) {
				wikiImageObject.thumb = "true";
			}
		}

		// now process the image size, width, caption and link if any set
		if (htmlImageObject['width']
			&& htmlImageObject['width'] !== wikiImageObject.sizewidth) {
			wikiImageObject.sizewidth = htmlImageObject['width'];
		} else if (!htmlImageObject['height']) {
			// default to width of 300 if nothing set for width or height
			wikiImageObject.sizewidth = 300;
		}
		if (htmlImageObject['height']
			&& htmlImageObject['height'] !== wikiImageObject.sizeheight) {
			wikiImageObject.sizeheight = htmlImageObject['height'];
		}
		if (htmlImageObject['caption']) {
			wikiImageObject.caption = htmlImageObject['caption'];
		}
		if (htmlImageObject['link']) {
			wikiImageObject.caption = htmlImageObject['link'];
		}

		// Build wikitext
		wikiText = [];
		wikiText.push(wikiImageObject.imagename);

		// process attributes of image
		for (property in wikiImageObject) {
			if ($.inArray(property, ['imagename', 'thumbsize']) !== -1) {
				continue; //Filter non-wiki data
			}
			if ($.inArray(property, ['left', 'right', 'center', 'nolink']) !== -1) {
				continue; //Not used stuff
			}
			value = wikiImageObject[property];
			//"link" may be intentionally empty. Therefore we have to
			//check it _before_ "value is empty?"
			if ( property === 'link' ) {
				//If the 'nolink' flag is set, we need to discard a
				//maybe set value of 'link'
				if( wikiImageObject.nolink === 'true' ) {
					wikiText.push( property + '=' );
					continue;
				}
				if ( value === 'false' || value === false ) {
					continue;
				}
				wikiText.push( property + '=' + value );
				continue;
			}
			if ( !value ) continue;
			if (property === 'sizewidth' ) {
				size = '';
				if (wikiImageObject.sizewidth && wikiImageObject.sizewidth !== "false") {
					size = wikiImageObject.sizewidth;
				}
				if (wikiImageObject.sizeheight && wikiImageObject.sizeheight !== "false") {
					size += 'x' + wikiImageObject.sizeheight;
				}
				if (size.length == 0 || size == "auto") continue;
				size += 'px';
				wikiText.push(size);
				continue;
			}
			if (property == 'alt') {
				wikiText.push(property + '=' + value);
				continue;
			}
			if ( property == 'align' ) {
				wikiText.push(value);
				continue;
			}
			if ( property == 'verticalalign' ) {
				wikiText.push(value);
				continue;
			}
			if ( property == 'title' ) {
				imageCaption = value;
				continue;
			}
			if ( property == 'caption' ) {
				imageCaption = value;
				continue;
			}
			if ( property == 'thumb' && value === "true" ) {
				wikiText.push( 'thumb' );
				continue;
			}
			if ( property == 'frame' && value === "true") {
				wikiText.push( 'frame' );
				continue;
			}
			if ( property == 'border' && value === "true" ) {
				wikiText.push( 'border' );
				continue;
			}
		}

		// make sure image caption comes in the end
		if ( imageCaption ) {
			wikiText.push( imageCaption );
		}
		if (imageLink) {
			dstName = dstName + "|link=" + imageLink;
			aLink = '[[' + _mwtFileNamespace + ':' + dstName + wikiText.join('|') + ']]';
		} else {
			aLink = '[[' + _mwtFileNamespace + ':' + dstName + wikiText.join('|') + ']]';
		}

		return aLink;
	};

	/**
	 * get parsed html from the wiki text provided.  Returns the
	 * parsed html, original wikitext and a success/fail indicator
	 *
	 * @param {String} text
	 * @returns {String}
	 */
	function _getParsedHtmlFromWiki(wikiText) {
		var data = {
				'action': 'parse',
				'title': _mwtPageTitle,
				'text': wikiText,
				'prop': 'text|wikitext',
				'disablelimitreport': '',
				'disableeditsection': '',
				'disabletoc': '',
				'wrapoutputclass': '',
				'format': 'json',},
			parserResult = [];
		$.ajax({
			type: 'POST',
			dataType: "json",
			url: _mwtWikiApi,
			data: data,
			async: false,
			success: function(data) {
				var parsedHtml = data.parse.text["*"],
					parsedWikiText = data.parse.wikitext["*"];

				// replace encoded & characters
				parsedHtml = parsedHtml.replace(/\&amp\;/gmi,'&');

				// remove leading and trailing <div class="mw-parser-output"> in parsed html
				parsedHtml = parsedHtml.replace(/^<div class="mw-parser-output">([^]*)<\/div>$/gmi, '$1');

				// remove <p> tags in parsed html
				parsedHtml = parsedHtml.replace(/<\/?p(>|\s[^>]*>)/gmi, '');

				// remove leading and trailing spaces
				parsedHtml = $.trim(parsedHtml);

				// set up array of returned values
				parserResult['parsedWikiText'] = parsedWikiText;
				parserResult['parsedHtml'] = parsedHtml;		
				parserResult['result'] = 'success';		
			},
			error:function(xhr,status, error){
				parserResult['parsedWikiText'] = '';
				parserResult['parsedHtml'] = '';		
				parserResult['result'] = 'fail';		
				parserResult['error'] = error;		
			}
		});

		return parserResult;
	}

	/**
	 * parses wiki code before calling function for
	 * creating the DOM element and storing this
	 * and and original wikicode for later recovery
	 *
	 * @param {String} wikiCode
	 * @returns {String}
	 */
	function _parseWiki4Html (wikiCode) {
		var parserResult = [],
			tagWikiText = '',
			tagInnerHTML = '';


		// it could be that the wikicode already contains placeholders
		// for example for templates.  We need to convert these back before sending
		// to the wiki parser.  
		wikiCode = _recoverPlaceholders2Wiki( wikiCode );

		// then get the parsed wiki code from the wiki parser
		parserResult = _getParsedHtmlFromWiki(wikiCode);

		// check result
		if ( parserResult.result == 'fail' ) {
			message = translate("tinymce-wikicode-alert-mw-parser-fail", wikiCode);								
			alert( message );
			parserResult.parsedHtml = wikiCode;
		}

		return parserResult;
	}

	/**
	 * Convert wiki links to html and preserves them for recovery later.
	 *
	 * @param {String} text
	 * @returns {String}
	 */
	function _preserveLinks4Html(text) {
		var links, 
			targetParts, 
			linkType, 
			squareBraceDepth = 0,
			linkDepth = 0,
			linkStart = 0,
			tempLink = '',
			linkPlaceholder,
			regex,
			matcher,
			pos = 0,
			urlProtocolMatch = "/^" + _mwtUrlProtocols + "/i";


		// save some effort if there are no links
		if ( !text.match(/\[/) ) return text;

		urlProtocolMatch = urlProtocolMatch.replace(/\|/g,"|^");

		// now walk through the text processing all the
		// links storing external links and internal links
		// in arrays to process later
		for (pos = 0; pos < text.length; pos++) {
			if (text[pos] === '[') {
				squareBraceDepth++;
				linkStart = pos;

				// check to see if an internal link eg starts with [[
				// and process as intrnal link if it is
				if (pos < text.length) {
					if (text.charAt(pos + 1) === '[') {
						pos = pos + 2;
						squareBraceDepth++;
						for (pos = pos; pos < text.length; pos++) {
							if (text[pos] === '[') {
								squareBraceDepth++;
							} else if (text[pos] === ']') {
								if (squareBraceDepth == 2) {

									// checking for closure of internal link eg ]]
									// if not then don't decrement depth counter
									// otherwise won't be able to match closure
									if ((pos < text.length) && (text.charAt(pos + 1) === ']')) {
										pos = pos +1;
										squareBraceDepth = 0;

										// make a temporary copy of the link 
										tempLink = text.substring(linkStart,pos + 1);
										
										// recover any placeholders
										tempLink = _recoverPlaceholders2Wiki( tempLink );

										//set the type of the link
										linkType = 'internallink';

										// check to see if the link is to a media file (namespace is 6)
										// if it is change the link type to image
										targetParts = tempLink.substr(2,tempLink.length).split(":");
										if (targetParts.length > 1) {
											if (_mwtNamespaces[targetParts[0].toLowerCase()] === 6) {
												linkType = 'image';
											}
										} else {
											// make sure we include any text immediately following 
											// the link to ensure we obey 'linktrail' rules
											// Check there is more text after the pos by the way
											while (pos < text.length) {
												if (text.charAt(pos + 1).match(/\w/)) {
													pos = pos +1;
												} else {
													break;
												}
											}

											// make a temporary copy of the link 
											tempLink = text.substring(linkStart,pos + 1);
										}
										linkPlaceholder = _getPlaceHolder4Html(tempLink, 'toParse', linkType, 'nonEditable');

										// replace the link with the placeholder
										regex = tempLink.replace(/[^A-Za-z0-9_]/g, '\\$&');
										matcher = new RegExp(regex, '');
										text = text.replace(matcher, linkPlaceholder);

										// reset the text.length and
										// set the pos to the end of the placeholder
//										text.length = text.length;
										pos = linkStart + linkPlaceholder.length - 1;
										tempLink = '';
										break;
									}
								} else {
									squareBraceDepth--;
								}	
							}
						}
					} else {
						// else process external link as only single '['
						pos = pos + 1;
						linkType = 'externallink';
						for (pos = pos; pos < text.length; pos++) {
							if (text[pos] === '[') {
								squareBraceDepth++;
							} else if (text[pos] === ']') {
								if (squareBraceDepth == 1) {
									// checking for closure of external link eg ']'
									pos ++;
									squareBraceDepth = 0;

									tempLink = text.substring(linkStart,pos)

									// recover any placeholders
									tempLink = _recoverPlaceholders2Wiki( tempLink );

									// if this is a valid url and doesn't start witha space
									// then process as an external link, else ignore
									// but look for links within these braces
									if (tempLink.substr(1,tempLink.length - 2).match(urlProtocolMatch)
										|| tempLink.substr(1,2) === "//" ) {
									
										linkPlaceholder = _getPlaceHolder4Html(tempLink, 'toParse', linkType, 'nonEditable');
										regex = tempLink.replace(/[^A-Za-z0-9_]/g, '\\$&');
										matcher = new RegExp(regex, '');
										text = text.replace(matcher, linkPlaceholder);
	
										// reset the textlength and
										// set the pos to the end of the placeholder
										pos = linkStart + linkPlaceholder.length - 1;
									} else {
										// add two to link start as double square braces 
										// will have been processed already as an 
										// internal link. Then continue searching
										pos = linkStart;// + 1;
//										squareBraceDepth--;
									}
									tempLink = '';
									break;
								} else {
									squareBraceDepth--;
								}	
							}
						}					
					}
				}
			}
		}
		return text;
	}

	/**
	 *
	 * recover html tag text from placeholdes
	 * @param {String} text
	 * @returns {String}
	 */
	function _recoverTags2html(text) {
		var regex,
			tagLabel,
			parserText,
			parserTable = [],
			parserTags = [],
			parserTag,
			elementTitle,
			count = 0,
			regex,
			matcher,
			blockMatcher;

		// the block matcher is used in a loop to determine whether to wrap the returned 
		// html in div or span tags, we define it here so it only has to be defined once
		regex = "<(" + _mwtBlockTagsList + ")";
		blockMatcher = new RegExp(regex, 'i');

		// we use the parser table to collect all the wikicode to be parsed into a single
		// document to avoid multiple calls to the api parser so speed things up
		// there are two passes one to collect the parser text and the next to insert it
		if (_tags4Html) {
			// replace paceholders that don't need to be parsed with their 
			// html equivalents, except html entities, which may be embedded
			// in other html to preserve it!!
			text = text.replace(/\{@@@(?!HTMLENTITY).*?:\d*@@@}/gmi, function(match) {
				// if the placeholder is in the array replace it otherwise
				// return the placeholder escaped
				if ((_tags4Html[match] == 'toParse') && (_tags4Wiki[match])) {
					parserTable.push(_tags4Wiki[match]);
					parserTags.push(match);
					return match
				} else if (_tags4Html[match]) {
					return _tags4Html[match];
				} else {
					return match.replace(/^{/, '&#123;');						
				}
			});

			// second pass to pick up any html entities in titles that were retained to ensure
			// they were preserved
			text = text.replace(/title=('|")(\{@@@HTMLENTITY:\d*@@@})/gmi, function(match, $1, $2) {
				// $1 = type of quotation mark
				// $2 = the id
				return 'title=' + $1 + _tags4Wiki[$2].replace(/&amp;amp;/gm, '&amp;');
			});
			
			// next pass to pick up any other html entities that were retained to ensure
			// they were preserved
			text = text.replace(/\{@@@HTMLENTITY:\d*@@@}/gmi, function(match) {
				return _tags4Html[match];
			});
			
			// if there is anything to be parsed then join the table entries with a placeholder
			// and send it to be parsed, then split out the parsed code and replace it 
			// within the text
			if (parserTable.length > 0) {
				// we need to wrap the seperator {@@@@} with two '\n's because
				// of the way pre and pseudo pre tags are handled in the wiki parser

				// add trailing separator in case last item parses as nothing
				parserText = parserTable.join( "\n{@@@@}\n" ) + "\n{@@@@}\n";

				parserText = parserText.replace(/\{@@@HTMLENTITY:\d*@@@}/gmi, function(match) {
					return _tags4Wiki[match];
				});

				parserText = _parseWiki4Html( parserText );

				// sometimes the parser wraps the {@@@@) placeholder in <p> tags!
				parserText.parsedHtml = parserText.parsedHtml.replace(/<p>\n{@@@@}\n<\/p>/gmi, "\n{@@@@}\n");

				// sometimes the parser return null entries which will be misinterpreted !
				// we put a nbsp there so that the span doesn't get sanitized away :-)
				parserText.parsedHtml = parserText.parsedHtml.replace(/{@@@@}\n(?={@@@@})/gmi, function (match) {

					return "{@@@@}\n&nbsp;\n"
				});
				
				// replace trailing separator
				parserText.parsedHtml = parserText.parsedHtml.replace(/\n{@@@@}$/, '')
				
				//sometimes we just get the delimeter {@@@@} so we set the result to undefined
				if ( parserText.parsedHtml == '{@@@@}' ) parserText.parsedHtml = undefined; 

				// now split the parsed html corresponding to the placeholders
				// and replace within the text
				parserText.parsedHtml ? parserTable = parserText.parsedHtml.split("\n{@@@@}\n") : parserTable = [];
				for ( count = 0; count < parserTags.length; count++) {
					parserTag = parserTags[count];
					regex = parserTag;
					matcher = new RegExp(regex, 'gmi');
					text = text.replace(matcher, function(tag) {
						var tagClass = tag.replace(/{@@@(.*):\d+?@@@}/gm, '$1').toLowerCase(),
							tagId = tag.replace(/{@@@(.*:\d+?)@@@}/gm, '$1'),
							wikiText,
							html,
							dom,
							element,
							regex,
							matcher;

						html = $.trim( parserTable[count] );
						elementTitle = _tags4Wiki[tag].replace(/{@@nl@@}/gmi, "\n");

						if ( html == undefined ) html = _nrw;

						// check to see html is not a simple element (not text) and
						// wrap in a span if it isn't
						element = $( '<span>' ).html( html );
						if ( element[0].childNodes.length == 1  && 
							element[0].childElementCount != 0 ) {
							element = $( html );
						}

						// now build the html equivalent from each parsed wikicode fragment
						element.attr({
							'title': elementTitle,
							'id': tagId,
							'data-mwt-type': tagClass,
							'data-mwt-wikitext': htmlEncode( elementTitle.replace( /\n/gi, '{@@nl@@}' ) ), 
							'draggable': "true",
							'contenteditable': "false"
						});
						
						if ((tagClass == 'internallink' )|| (tagClass == 'externallink' )) {
							element.attr({
								'href': ( element.attr( "href" ) ? element.attr( "href" ) : '#')
							});
						}

						if (tagClass == 'image' ) {
							element.addClass("mwt-nonEditableImage mwt-wikiMagic mwt-placeHolder mwt-" + tagClass + " " + _placeholderClass);
						} else if ( _mwtPlainTextTags.includes( tagClass )) {
							var sameLine = true;
							// check if content starts on a new line and save if it does
							if ( _tags4Wiki[tag].match(/<pre[^>]*>\s*\n/) ) {
//								sameLine = false;
							}
							element.addClass("mwt-editable mwt-" + tagClass);
							element.attr({
								'title': tagClass,
								'data-mwt-sameLine': sameLine,
								'contenteditable': "true"
							});
						} else {
							element.addClass("mwt-nonEditable mwt-wikiMagic mwt-" + tagClass);
						}

						// preserve the html for later recovery
						_tags4Html[tag] = element.prop("outerHTML");//.replace(/(<pre[^>]*>)\s*\n/, '$1' );

						return _tags4Html[tag] ;
					});
				}
			}
		}

		return text;
	}

	/**
	 * Processes wiki text into html.
	 *
	 * @param {String} text
	 * @returns {String}
	 */
	function _convertWiki2Html(text, mode) {
		var textObject;

		/**
		 * Converts wiki tags to html and preserves them as placeholders in the text
		 * for recovery later.
		 *
		 * @param {String} text
		 * @returns {String}
		 */
		function preserveWikiTags4Html(text) {
			var regex, 
				matcher,
				preservedTags = _mwtPreservedTagsList.split('|'),
				plainTextTagsList = _mwtPlainTextTags.join('|');

			// find and process all the switch tags in the wiki code
			// may contain wikitext so process first to avoid processing tags within tags
			regex = "__(.*?)__";
			matcher = new RegExp(regex, 'gmi');
			text = text.replace(matcher, function(match) {

				return _getPlaceHolder4Html(match, _swt, 'switch', 'nonEditable');
			});

			// find and process all the comment tags in the wiki code
			// may contain wikitext so process first to avoid processing tags within tags
			regex = "<!--([^]+?)-->";
			matcher = new RegExp(regex, 'gmi');
			text = text.replace(matcher, function(match, $1) {
				// $1 = content of the comment
				var comHtml,
					id = 'R' + createUniqueNumber();
	
				comHtml = $1.replace(/</gm, '{@@@LTE:0@@@}');
				comHtml = comHtml.replace(/\n/gm, '{@@@ENL:0@@@}');
				
				if ( comHtml == '' ) {
					comHtml = 'Empty comment'
				}
				
				// create inner span that contains the content of the comment
				comHtml = 
					'<span class="mwt-editable mwt-comment'  
					+ '" id="' + id
					+ '" data-mwt-type="comment"'
					+ '" draggable="false" contenteditable="true">' 
					+ comHtml
					+ '</span>';
				
				// create outer span that contains the visible comment placeholder
				comHtml = '<span class="mwt-placeHolder mwt-commentHolder mwt-hidePlaceholder" title="' 
					+ translate( 'tinymce-editcomment' ) 
					+ '" data-mwt-type="comment" contenteditable="false" draggable="true" data-mwt-ref="' 
					+ id + '">' 
					+ comHtml 
					+ '</span>';
				  
				return _getPlaceHolder4Html(match, comHtml, 'comment', 'editable')	
			});

			// nowiki tags can be used to escape html so process
			// these before processing other tags

			// case <<nowiki />atag ...>
			regex = '<<nowiki\\s*?\\/?>([\\S\\s]*?>)';
			matcher = new RegExp(regex, 'gm');
			text = text.replace(matcher, function(match,$1) {
				//$1 = the text in the escaped tag
				var html;

				html = '<span class="mwt-nonEditable mwt-wikiMagic">&lt;' + $1 + '</span>';
				return _getPlaceHolder4Html(match, html, 'nowikiesc', 'nonEditable');
			});

			// case <atag ...<nowiki />> ... </atag>
			regex = '<(\\w*)[\\S\\s]*?<nowiki\\s*?\\/>>[\\S\\s]*?<\\/\\1>';
			matcher = new RegExp(regex, 'gm');
			text = text.replace(matcher, function(match) {

				return _getPlaceHolder4Html(match, 'toParse', 'nowikiesc', 'nonEditable')
			});

			// find and process all the <nowiki /> tags in the wiki code
			regex = '<nowiki\\s*?\\/>';
			matcher = new RegExp(regex, 'gmi');
			text = text.replace(matcher, function(match) {

				return _getPlaceHolder4Html(match, '', 'nowikiesc', 'nonEditable')
			});

			// find and process all the plain text tags in the wiki code as wiki markup is ignored
			regex = '(<(' + plainTextTagsList + ')[\\S\\s]*?>)([\\S\\s]*?)(<\\/\\2>)';
			matcher = new RegExp(regex, 'gmi');
			text = text.replace(matcher, function(match, $1, $2, $3, $4) {
				// $1 = the opening tag 
				// $2 = the tag name
				// $3 = the content of the tag pair
				// $4 = the closing tag
				var html;

				// htmlencode the contents to avoid it being treated as html
				$3 = _recoverPlaceholders2Wiki( $3 );
				$3 = $3.replace(/&amp;/gm, '{@@@AMPAMP:0@@@}');
				$3 = $3.replace(/</gm, '{@@@LTE:0@@@}');
				$3 = $3.replace(/>/gm, '{@@@GTE:0@@@}');
				
				if ( $2 == 'nowiki' ) {
					// turn nowiki tag into span tag
					$1 = $1.replace(/^<nowiki/, '<span class="mwt-nowiki" data-mwt-type="nowiki"');
					$3 = $3.replace(/^\n/, '{@@@SLB:0@@@}')
					$3 = $3.replace(/\n$/, '\n{@@@ENL:0@@@}')
					$4 = '</span>';
				} else if ( $2 == 'source' ) {
					// turn nowiki tag into span tag
					$1 = $1.replace(/^<source/, '<pre class="mwt-source" data-mwt-type="source"');
					$4 = '</pre>';
				} else if ( $2 == 'pre' ) {
					// special case if pre start with new lines followed by a nowiki then
					// one of the new lines is silent (omg)
					$1 = $1.replace(/^<pre/, '<pre class="mwt-pre" data-mwt-type="pre"');
					$3 = $3.replace(/^\n/, '{@@@SLB:0@@@}')
				} else {
					$1 = $1.replace(/>/, ' class="mwt-' + $2 +'" data-mwt-type="' + $2 + '">');
				}
					
				// protect the new lines in the match as the wiki parser
				// will strip these at the start of the text
				html = $1 + $3 + $4;
				if ( $2 != 'nowiki' ) {
					html = html.replace(/\n/gmi, '{@@@ENL:0@@@}');
				}
				// make sure any html embedded gets renderred correctly by encoding '<'s
				// but leave placeholders as these will be recovered
				return _getPlaceHolder4Html(match, html, $2, 'editable');
			});

			// preserve characters encoded in &xxx; format by placing them in spans 
			// with class of mwt_htmlEntity.  These are typically used 
			// to stop the wiki parser interpretting characters as formatting
			regex = '&([^\\s;]+);';
			matcher = new RegExp(regex, 'gmi');
			text = text.replace(matcher, function(match, $1) {
				//$1 = the encoded character
				var html;

				// encode the html entity so it is preserved when
				// converting back.  Double encode &amp;
				if (match == '&amp;' ) match = '&amp;amp;';
				match = htmlEncode( match );
				
				if ( $1  == 'nbsp' ) {
					// process non-breaking spaces 
					html = _nbs;
					return _getPlaceHolder4Html(match, html, 'htmlEntity', 'editable');
				} else if ( $1  == 'vert' ) {
					// process vertical pipe 
					return match;
				} else {
					// double encode &amp; otherwise will display incorrectly if recoverred
					html = '<span class="mwt-nonEditable mwt-wikiMagic ">&' + $1 + ';</span>';
					return _getPlaceHolder4Html(match, html, 'htmlEntity', 'nonEditable');
				}

			});

			// treat any extension tag pairs in the wikicode 
			// The list of extension tag codes is define in MW_tinymce.js in the extension root
			regex = '<(' + _mwtExtensionTagsList + ')(\\s.*?>|>)([\\S\\s]*?)<\\/\\1>';
			matcher = new RegExp(regex, 'gmi');

			text = text.replace(matcher, function(match, $1, $2, $3) {
 						id = 'R' + createUniqueNumber();

				// $1 = the tag name
				// $2 = attributes of the tag
				// $3 = the content of the tag pair
				
				// special proceessing if this is a reference using cite extension
				if ( $1 == 'ref' ) {
					// $1 = content of the comment
					var refHtml,
						id = 'R' + createUniqueNumber();

					if ( !$3.includes( "mwt-dummyReference" )) {
						$3 = '<span class="mwt-hideReference mwt-reference" contenteditable="true" id="' + id + '">'
						+ $3 + '</span>';
					}

					refHtml = $3.replace(/\n/gm, '{@@@ENL:0@@@}');
					refHtml = refHtml.replace(/([^}])\{@@@ENL:0@@@}\{@@@ENL:0@@@}/gmi, '$1{@@@ELF:0@@@}');
					refHtml = _convertWiki2Html( $.trim( $3 ), "inline" );

					if ( refHtml.includes( "mwt-dummyReference" )) {
						refHtml = refHtml.replace(/mwt-dummyReference/, 'mwt-reference mwt-showReference' );
						refHtml = refHtml.replace(/\>/, ' id="' + id + '">');
					}
					
					if ( refHtml == '' ) {
						refHtml = ' ' + translate( 'tinymce-empty-reference' );
					}
					
					// create inner span that contains the content of the reference
					refHtml = '<span class="mwt-placeHolder mwt-referenceHolder mwt-editable'
						+ '" title="' + translate( 'tinymce-editreference' ) 
						+ '" data-mwt-type="reference" contenteditable="false" draggable="true" data-mwt-ref="' 
						+ id + '"> ' 
						+ refHtml 
						+ ' </span>';
					return _getPlaceHolder4Html(match, refHtml, 'reference', 'editable')	
				} else {
					return _getPlaceHolder4Html(match, 'toParse', $1, 'nonEditable');
				}
			});

			// then treat extension tag singletons
			regex = '<(' + _mwtExtensionTagsList + ')(\\s.*?\\/?>|\\/?>)';
			matcher = new RegExp(regex, 'gmi');
			text = text.replace(matcher, function(match, $1) {
				// $1 = the tag name

				return _getPlaceHolder4Html(match, 'toParse', $1, 'nonEditable');
			});

			// treat any tags in the wikicode that aren't allowed html or 
			// extension tags as by replacing the angle brackets with their
			// html entity equivalents
			// The list of preserved codes is define in MW_tinymce.js in the extension root

			// first unrecognised tag pairs
			regex = '<((\\w+?)((\\s+?\\w+?(\\W*?=\\s*?(?:".*?"|' + "'" + ".*?'|[\\^'" + '"' + '>\\s]+?))?)+?\\s*?|\\W*?))>([\\S\\s]*?)<\\/\\2>';
			matcher = new RegExp(regex, 'gmi');
			text = text.replace(matcher, function(match, $1, $2, $3, $4, $5, $6, $7) {
				// $1 = content of the opening tag
				// $2 = opening tag name
				// $6 = content enclosed by the tags
				var html;
				
				if (preservedTags.indexOf( $2 ) > -1) {
					// if valid wiki or html tag then ignore
					return match;
				} else {
					// replace angle brackets with html equivalents
					return '{@@@LTE:0@@@}' + $1 + '{@@@GTE:0@@@}' + $6 + '{@@@LTE:0@@@}' + '/' + $2 + '{@@@GTE:0@@@}';
				}
			});

			// then treat unrecognised tag singletons
			regex = '<(\\/?(\\w+)[^>\\w]?[^>]*?)>';
			matcher = new RegExp(regex, 'gmi');
			text = text.replace(matcher, function(match, $1, $2, $3, $4, $5, $6) {
				// $1 = tag name
				var html;

				if (preservedTags.indexOf( $2 ) > -1) {
					// if valid wiki or html tag then ignore
					return match;
				} else {
					return '{@@@LTE:0@@@}' + $1 + '{@@@GTE:0@@@}';
				}
			});

			// treat <ins> here as they may break the batch mediawiki parsing
			// done for other tags. Hopefully they aren't nestable!
			regex = '<(ins)[\\S\\s]*?>[\\S\\s]*?<\\/\\1>';
			matcher = new RegExp(regex, 'gmi');
			text = text.replace(matcher, function(match, $1, offset) {
				// $1 = the tag
				var parserResult;

				parserResult = _parseWiki4Html(match);
				// remove the extraneous new line if inserted at end!
				return _getPlaceHolder4Html(parserResult.parsedWikiText, $.trim(parserResult.parsedHtml), $1, 'nonEditable')
			});

			// then treat special case of </> 
			regex = '<\\/>';
			matcher = new RegExp(regex, 'gmi');
			text = text.replace(matcher, function(match) {
				var html;

				html = '<code class="mwt-nonEditable mwt-wikiMagic">' + match.replace(/\</gmi, '&lt;') + '</code>';
				return _getPlaceHolder4Html(match, html, 'unknown', 'nonEditable');
			});

			text = text.replace(/(^|\n{1,2})((----+)([ ]*)(.*))(\n{1,2})/gi, function(match, $1, $2, $3, $4, $5, $6, offset, string) {
				// $1 = start of text or new line that preceeds the '-----'
				// $2 = the match minus everything before the dashes
				// $3 = the dashes in the original wikicode, must be four or more
				// $4 = any spaces that follow the dashes on the same line
				// $5 = any text following the spaces on the same line
				// $6 = any new lines following the text on the same line

				// Because of a quirk with mediawiki, a horizontal rule can be followed by spaces and text
				// The text is displayed on a new line. Because it is displayequivelent we put this text 
				// onto a new line which allows the whole construct to be editable in TinyMCE.  We don't
				// bother trying to place the text back onto the same line on save!
				var postNewLines = $6,
					placeHolder,
					wikiText = '{@@bnl@@}' + $3 + $4 + '{@@bnl@@}', 
					html = '<hr class="mwt-hr mwt-wikiMagic" data-mwt-wikitext="' + htmlEncode(wikiText) + '">';

				// we need to keep put the '\n's in here in case a table or other block
				// starts on the next line.  If there are 2 then one is non-rendering
				// and we use a placehoder so it is revealed in the editor window
				if ((postNewLines.length == 1) && ($5 != '' )) {
					postNewLines = '<br>' + postNewLines;
				}

				// we also need to process the case where there is text on
				// the same line as the '-'s
				placeHolder = _getPlaceHolder4Html(wikiText, html, 'hr', 'editable');

				return $1 + placeHolder + $5 + postNewLines;
			});

			return text;
		}

		/**
		 * Convert html tags embedded in the wiki code which shouldn't
		 * be converted back to wiki code on saving and preserve them for recovery later.
		 *
		 * @param {String} text
		 * @returns {String}
		 */
		function preserveNonWikiTags4Html(text) {
			var $dom,
				regex, 
				matcher,
				extensionTags,
				preservedTags,
				invariantTags;

			/**
			 * Convert child elements which shouldn't be converted back to 
			 * wiki code on saving and preserve them for recovery later.
			 * BEWARE recursive function
			 *
			 * @param {element} dom element
			 * @returns {} dom is update by function
			 */
			function convertChildren( element, level ) {
				//be aware this function is recursive

				// if the tag is an html tag then we don't need to parse
				// it with the mediawiki parser but we do want to preserve it
				// so it doesn't get converted to wiki markup when being saved
				// but remains as html in the wiki code 
				var elm,
					elmTagName,
					html,
					innerHTML,
					outerHTML,
					id;

				element.children().each( function() {
					if ($(this).children()) convertChildren( $(this), level + 1 );

					elm = $(this);
					elmTagName = elm.prop("tagName").toLowerCase();
					innerHTML = elm.prop("innerHTML");
					outerHTML = elm.prop("outerHTML");

					// If this Tag is allowed by mediawiki but has no wiki markup
					// equivalent then it doesn't need to be protected in the TinyMCE
					// editor.  Everything else need to be preserved
					if ((extensionTags.indexOf(elmTagName) > -1) || 
						(preservedTags.indexOf(elmTagName) > -1)) {
						// process other tags that are allowed by mediawiki

						if (elm.attr( "title")) {
							elm.attr( "title", function (i, title) {
								// revert any placeholders in the title, double decoding
								// any htmlentities because they were double encoded!
								title = _recoverPlaceholders2Wiki( title );
								return title;
							});
						}
						
						if ((elmTagName != 'table')
							&& (elmTagName != 'tbody')
							&& (elmTagName != 'tr')) {
							// conserve any new lines in the inner html
							// except in table tags that don't contain data!			
							innerHTML = innerHTML.replace(/\n/gmi,'{@@vnl@@}');
						} else {
							// if table markup the remove spaces at start of lines
							innerHTML = innerHTML.replace(/\n\s*/gmi,'\n');
						}
						elm.prop( "innerHTML", innerHTML );

						if ((elmTagName != 'table')
							&& (elmTagName != 'tbody')
							&& (elmTagName != 'thead')
							&& (elmTagName != 'tfoot')
							&& (elmTagName != 'caption')
							&& (elmTagName != 'th')
							&& (elmTagName != 'td')
							&& (elmTagName != 'tr')) {

							elm.addClass( "mwt-preserveHtml" );
						}
						
						outerHTML = elm.prop("outerHTML");

					}
					
					elm.replaceWith( outerHTML );

					return;
				} );
			}

			// turn the regex list of tags into an arryay
			extensionTags = _mwtExtensionTagsList.split('|');
			preservedTags = _mwtPreservedTagsList.split('|');
			invariantTags = _mwtInvariantTagsList.split('|');
			
			// convert the text in the editor to a DOM in order
			// to process the embedded html tags		
			$dom = $( "<tinywrapper>" + text + "</tinywrapper>" );

			// process each element in the dom recursively
			// be aware this next function is recursive
			convertChildren($dom, 0 );

			// convert DOM back to html text and decode html entities
			text = htmlDecode ( $dom.html() );

			// find and process pseudo <pre> tags where wikicode lines starts with spaces.  If
			// several consecutive lines start with a space they are treated as a single <pre> block.
			// If the space is followed by any tag or | then ignore
			regex = '(^|\\n)(([ ][^]*?\\n)+)'; //0119
			matcher = new RegExp(regex, 'gmi');
			text = text.replace(matcher, function(match, $1, $2, $3, $4, offset, string) {
				// $1 = the new lines preceding the text in pseudo <pre>s

				// $2 = lines starting with spaces to be placed in the pseudo <pre>s //0119
				// $3 = the line following the text in pseudo <pre>s //0119
				var tagName,
					html;

				if ( $2.match( /^\s*\{\|/ ) ) {
					// spaces before the opening '{|' of a table aren't treated as a pseodo pre
					return match;
				} else if ( $2.match(/^\s*{@@@NOWIKI:\d*@@@}\s*$/) ) {
					var id = $2.match(/{@@@NOWIKI:\d*@@@}/); 
					// pseudo nowiki is plain text so treat differently
					tagName = 'pnowiki';
					html = _tags4Html[ id ].replace(/^<span class="mwt-nowiki" data-mwt-type="nowiki"([^]*)\/span>$/, '<pre class="mwt-pnowiki" data-mwt-type="pnowiki"$1/pre>');
					return $1 + _getPlaceHolder4Html($2, html, tagName, 'editable') + '\n';
				} else {
					// we need to preserve any new lines so they aren't lost when we
					$2 = $2.substring( 1, $2.length );
					// decode the contents of any preserved html tags
					$2 = $2.replace(/\n /gmi,'{@@@ENL:0@@@}');
					$2 = _convertWiki2Html( $2 );

					tagName = 'ppre';
					html = '<pre class="mwt-ppre" data-mwt-type="ppre">' + $2 + '</pre>';
					return $1 + _getPlaceHolder4Html(match, html, tagName, 'editable') + '\n';
				}
			});

			// recover any remaining new line placeholders
			text = text.replace(/{@@vnl@@}/gmi, '\n')

			// now we want to conserve, as much as we can, any formatting of retained html tags
			// in the wiki text.  This is typcally used to make the wiki text more readable
			var regex = "^(\\||\\:|\\;|#|\\*)?(\\s*)(<" 
					+ _mwtPreservedTagsList.split('|').join('[^>]*?>|<')
					+ _mwtInvariantTagsList.split('|').join('[^>]*?>|<')
					+ "[^>]*?>)(.*)$",
				matcher = new RegExp(regex, 'i'),
				regex1 = "(\\s*)(<" 
					+ _mwtPreservedTagsList.split('|').join('[^>]*?>|<')
					+ _mwtInvariantTagsList.split('|').join('[^>]*?>|<')
					+ "[^>]*?>])",
				matcher1 = new RegExp(regex1, 'gmi');

			// step through text a line at a time looking for lines 
			// that contain html tags.  This is an imperfect process as 
			// we can't give attributes to closing tags 
			var lines = text.split(/\n/);

			for (var i = 0; i < lines.length; i++) {
				var line = lines[i];

				line = line.replace(matcher, function (match, $1, $2, $3, $4) {
					// $1 = new line start table cell or list delimeter
					// $2 = spaces before embedded html tag
					// $3 = first embeddedhtml tag
					// $4 = the rest of the line
					var spaces = $2,
						firstTag = $3;

					/// add new line and spaces data to first tag
					if (!$1) {
						$1 ='';
						firstTag = firstTag.replace(/(^<[^>]*?)>/i, '$1 data-mwt-sameLine="false" data-mwt-spaces="' + spaces + '">');
					} else {
						firstTag = firstTag.replace(/(^<[^>]*?)>/i, '$1 data-mwt-sameLine="true" data-mwt-spaces="' + spaces + '">');
					}

					// now process any remaining embedded html tags in the line
					$4 = $4.replace( matcher1, function (match, $1, $2){
						// $1 = spaces before tag
						// $2 = the block tag
						var moreSpaces = $1,
							anotherTag = $2;

						anotherTag = $1 + anotherTag.replace(/(^<[^>]*?)>/i, '$1 data-mwt-sameLine="true" data-mwt-spaces="">');
						return anotherTag;
					});

					return $1 + firstTag + $4;
				});

				lines[ i ] = line;
			}
			text = lines.join( '\n' );

			return text;
		}

		/**
		 * Converts wiki templates to html and preserves them for recovery later.
		 *
		 * @param {String} text
		 * @returns {String}
		 */
		function preserveTemplates4Html(text) {
			var 
				regex, 
				matcher, 
				pos,
				templateStart = 0, 
				curlyBraceDepth = 0, 
				templateDepth = 0,
				tempTemplate = '', 
				placeHolder,
				parserResult,
				checkedBraces = new Array();

			// save some effort if there are no templates
			if ( !text.match(/\{\{/) ) return text;

			// step through text a character at a time looking for templates
			for (pos = 0; pos < text.length; pos++) {
				if (text[pos] === '{') {
					curlyBraceDepth++;
					if (text.charAt(pos + 1) === '{') {
						if (templateDepth == 0) {
							templateStart = pos;
						}
						curlyBraceDepth++;
						templateDepth++;
						pos++
					}
				}
				if (text[pos] === '}') {
					if (curlyBraceDepth > 0 ) curlyBraceDepth--;
					if ((text.charAt(pos + 1) === '}') && (templateDepth > 0 )) {
						curlyBraceDepth--;
						templateDepth--;
						pos++
						if (templateDepth === 0) {
							tempTemplate = text.substring(templateStart,pos + 1);
							if (tempTemplate !== '' ) {
								placeHolder = _getPlaceHolder4Html(tempTemplate, 'toParse', 'template', 'nonEditable');
								if (placeHolder) {
									// replace each occurences of the
									// template call multiple replacement breaks
									// things later on 
									regex = tempTemplate.replace(/[^A-Za-z0-9_]/g, '\\$&');
									matcher = new RegExp(regex, '');
									text = text.replace(matcher, placeHolder);

									// reset the pointer to end of replaced text
									pos = templateStart + placeHolder.length - 1;
								}
								tempTemplate = '';
							}
							templateStart = 0;
							curlyBraceDepth = 0;
						}
					}
				}
			}
			return text;
		}

		/**
		 * Converts MW styles to HTML
		 *
		 * @param {String} text
		 * @returns {String}
		 */
		function styles2html(text) {
			// bold and italics
			// the ^' fixes a problem with combined bold and italic markup
			text = text.replace(/'''([^'\n][^\n]*?)'''([^']?)/gmi, '<strong>$1</strong>$2');
			text = text.replace(/''([^'\n][^\n]*?)''([^']?)/gmi, '<em>$1</em>$2');

			// div styles
			text = text.replace(/<div style='text-align:left'>(.*?)<\/div>/gmi, "<div align='left'>$1</div>");
			text = text.replace(/<div style='text-align:right'>(.*?)<\/div>/gmi, "<div align='right'>$1</div>");
			text = text.replace(/<div style='text-align:center'>(.*?)<\/div>/gmi, "<div align='center'>$1</div>");
			text = text.replace(/<div style='text-align:justify'>(.*?)<\/div>/gmi, "<div align='justify'>$1</div>");
			return text;
		}

		/**
		 * Processes wiki headings into html.
		 *
		 * @param {String} text
		 * @returns {String}
		 */
		function headings2html(text) {	
			// One regexp to rule them all, one regexp to find them,
			// one regexp to bring them all and in html bind them!!!
			text = text.replace(/(^|\n)(={1,6})(\s*)(\S.*?)(\s*)\2([^\n]*)(\n+|$)/img, 
				function(match, $1, $2, $3, $4, $5, $6, $7) {
				// $1 = the new line before the heading, if any 
				// $2 = the level of the heading
				// $3 = spaces before the content of the heading
				// $4 = the content of the heading
				// $5 = spaces after the content of the heading
				// $6 = text following heading on same line
				// $7 = new lines following the heading
				// $8 = offset
				// $9 = original text
				var heading,
					newLines = $7.length;

				// if there is text after the heading on the same line then 
				// treat as if not a heading
				if( $6.match(/\S/)) return match;

				// if no new lines before, make '' rather than undefined
				if( typeof $1 == 'undefined' ) {
					$1 = '';
				}
				
				// compensate for paragraphs being equivalent 
				// to two new lines
				newLines = newLines - 1;

				// build the html for the heading
				heading = $1 + "<h" + $2.length + 
					" class='mwt-heading'" +
					" data-mwt-headingSpacesBefore='" + $3 + "'" +
					" data-mwt-headingSpacesAfter='" + $5 + "'" +
					" data-mwt-headingNewLines=" + newLines + 
					" >" + $4 + "</h" + $2.length + ">" ;

				return heading + "\n";
			});
			return text;
		}

		/**
		 * Convert MW tables to HTML
		 *
		 * @param {String} text
		 * @returns {String}
		 */
		function tables2html(text, embedded) {
			var lines, 
				line,
				lastLine, 
				innerLines, 
				innerTable,
				tableAttr, 
				closeLine, 
				attr, 
				endTd,
				tdText, 
				tdAttr, 
				curLine,
				cells,
				cellStart, 
				wikiPipe,
				cellInLine,
				cellEmptyLineFirst,
				parts,
				curLine,
				cont, 
				tempcont,
				emptyLine,
				blockTagList,
				indented = false,
				inTable = false,
				inTr = false,
				inTd = false,
				inTh = false,
				start = 0,
				nestLevel = 0,
				regex,
				blockMatcher;

			/**
			 * Normalizes some MW table syntax shorthand to HTML attributes
			 *
			 * @param {String} attr
			 * @param {String} elm
			 * @returns {String}
			 */
			function tablesAttrCleanUp2html(attr, elm) {
				var regex,
					matcher;

				switch (elm) {
					case 'table':
						attr = attr.replace(/al="*?(.*)"*?/g, "align=\"$1\"");
						attr = attr.replace(/bc="*?(.*)"*?/g, "background-color=\"$1\"");
						attr = attr.replace(/va="*?(.*)"*?/g, "valign=\"$1\"");
						// get rid of spurious '|' delimiters
						attr = attr.replace(/\s\|\s/g, " ");
						break;
					case 'row':
						attr = attr.replace(/al="*?(.*)"*?/g, "align=\"$1\"");
						attr = attr.replace(/bc="*?(.*)"*?/g, "background-color=\"$1\"");
						attr = attr.replace(/va="*?(.*)"*?/g, "valign=\"$1\"");
						break;
					case 'cell':
						attr = attr.replace(/al="*?(.*)"*?/g, "align=\"$1\"");
						attr = attr.replace(/bc="*?(.*)"*?/g, "background-color=\"$1\"");
						attr = attr.replace(/cs="*?(.*)"*?/g, "colspan=\"$1\"");
						attr = attr.replace(/rs="*?(.*)"*?/g, "rowspan=\"$1\"");
						attr = attr.replace(/va="*?(.*)"*?/g, "valign=\"$1\"");
						attr = attr.replace(/wd="*?(.*)"*?/g, "width=\"$1\"");
						break;
				}

				// case where attr contains html like tags
				// stash these in html data attribute
				// otherwise they break the display
				regex = '<(\\S*?)(.*?)(>([\\S\\s]*?)<\\/\\1>)';
				matcher = new RegExp(regex, 'gmi');
				attr = attr.replace(matcher, function(match, $1) {
					var html;

					html = "data-mwt-" + $1 + "='" + match.replace(/\</gmi, '&lt;').replace(/\>/gmi, '&gt;') + "'";
					return html;
				});

				// save any placeholders in the data attributes too
				regex = '{@@@.*?:\\d*?@@@}';
				matcher = new RegExp(regex, 'gmi');
				attr = attr.replace(matcher, function(match, $1) {
					var html;

					html = "data-mwt-attr='" + _recoverPlaceholders2Wiki(match).replace(/\</gmi, '&amp;amp;lt;').replace(/\>/gmi, '&amp;amp;gt;') + "'";
					return html;
				});

				// special case where attribute is an empty placeholder
				attr = attr.replace(/^\s{0,2}(\s*)$/,"data-mwt-attr='$1'");
				return ' ' + attr;
			}

			// save effort if no tables in text, note table open can be preceded by a ':'
			if (!text.match(/(^|\n)\:?\s*\{\|/,'gm')) return text;

			// make a regular expresion matcher to see if a line contains a block element
			// this is used later when walking through the editor content line by line
			blockTagList = _mwtBlockTagsList.split("|").join(":\\d*@@@}|{@@@");
			regex = '^\\s*({@@@' + blockTagList + ':\\d*@@@}' +
				 '|<' + _mwtBlockTagsList.split("|").join("[\\s>]|<") +
				 '|<\\/' + _mwtBlockTagsList.split("|").join(">|<\\/") +
				 '|<br[^>]*>|\\*|\\#|\\:|\\;|\\||\\:?\\{\\|)' ;
			blockMatcher = new RegExp(regex, 'i');

			// if embedded is true it means we are processing a nested table recursively 
			if (typeof embedded == 'undefined') {
				embedded = false;
			}

			// replace multiple new lines after table start with single new line
			// and a data attribute to store the number of new lines for recovery later
//0125			text = text.replace(/(^|\n)(\{\|[^\n]*?)(\n+)/gmi, function(match, $1, $2, $3) {
			text = text.replace(/(^|\n)(\{\|[^\n]*?)(\n+)/i, function(match, $1, $2, $3) { //0125
				// $1 = start of page or new line before table defiunition
				// $2 = the first line of the table defintion 
				// $3 = the empty new lines immediately following the table definition
				var tableStart;

				// build the first line of the table with placeholders for the additional lines
				if ($3) {
					tableStart = " data-mwt-tableStartNewLines=" + $3.length;
				}
				tableStart = $1 + $2 + tableStart + "\n";

				return tableStart;
			});

			// pre-process the end of the table 
			text = text.replace(/\n\|\}([ ]*)(.*)\n(.*)(?=(\n|$))/gmi, function(match, $1, $2, $3, offset, string) {
				// $1 = spaces after table close
				// $2 = text after table close
				// $3 = text on line after table close if any

				if ($2) {
					// if there is text on the same line as the table end
					// then process this so it can be retrieved when converting back
					if ($3.match(/^(\s|&nbsp;)*$/)) {
						// if the line following is empty
						return '\n\|\}<div class="mwt-closeTable" mwt-spaces="' + $1 + '">' + $2 + '</div>\n';
					} else {
						return '\n\|\}<div class="mwt-closeTable" mwt-spaces="' + $1 + '">' + $2 + '</div>\n' + $3;
					}
				} else {
					return match;
				}
			});

			// step through text a line at a time looking for lines 
			// that that belong to tables
			lines = text.split("\n");
			for (var i = 0; i < lines.length; i++) {
				line = lines[i].match(/^\:?\s*\{\|(.*)/gi);
				lastLine = (i == lines.length - 1);

				// process non empty lines 
				if (line && line !== '') {
					// process nested table.  Extract nested table, then
					// send it back for wiki code to html conversion, beware: recursive
					if (inTable) {
						innerLines = '';
						nestLevel = 0;
						for (; i < lines.length; i++) {
							if (lines[i].match(/^\{\|(.*)/gi)) {
								nestLevel++;
								innerLines = innerLines + lines[i] + '\n';
								lines.splice(i, 1);
								i--;
							} else if (lines[i].match(/^\|\}/gi)) {
								if (nestLevel > 1) {
									innerLines = innerLines + lines[i] + '\n';
									lines.splice(i, 1);
									i--;
									nestLevel--;
								} else {
									innerLines = innerLines + lines[i];
									lines.splice(i, 1);
									i--;
									break;
								}
							} else {
								innerLines = innerLines + lines[i] + '\n';
								lines.splice(i, 1);
								i--;
							}
						}
						i++;
						embedded = true;
						innerTable = tables2html(innerLines, embedded);
						lines.splice(i, 0, innerTable);
						embedded = false;
						continue;
					}

					// take care, table start can be preceded by a ':' to force an indent
					lines[i] = line[0].replace(/^(\:?)\s*\{\|(.*)/, function(match, $1, $2) {
						// $1 = ':' if this table is in a definition (indented)
						// $2 = table attributes if any
						var attr,
							tableTag;

						// add in definition item coding if preceded by ':'
						// and remove any templates in attributes as these will mess it up
						if ($2) {
							attr = tablesAttrCleanUp2html($2, 'table');
							tableTag = "<table" + attr + ">";
						} else {
							tableTag = "<table>";
						}
						if ($1) {
							indented = true;
							return '<dl><dd class="mwt-list" data-mwt-sameLine="false">' + tableTag;
						} else {
							return tableTag;
						}
					});
					start = i;
					inTable = true;
				} else if (line = lines[i].match(/^\|\}/gi)) {
					// processing end of table
					closeLine = '';
					if (inTd) {
						closeLine = "</td>";
					}
					if (inTh) {
						closeLine = "</th>";
					}
					if (inTr) {
						closeLine += "</tr>";
					}
					if (indented) {
						lines[i] = closeLine + "</table></dd></dl>" + lines[i].substr(2, lines[i].length);
					} else {
						lines[i] = closeLine + "</table>" + lines[i].substr(2, lines[i].length);		
					}
					indented = inTr = inTd = inTh = inTable = false;

					// join together all the table lines into a single html line and then replace 
					// the tables lines with this html line
					start = 0;
				} else if ((i === (start + 1)) && (line = lines[i].match(/^\|\+(.*)/gi))) {
					// process caption
					parts = line[0].substr(2).split('|');
					if (parts.length > 1) {
						lines[i] = "<caption" + parts[0] + ">" + parts[1] + "</caption>";
					} else {
						lines[i] = "<caption>" + line[0].substr(2) + "</caption>";
					}
				} else if (line = lines[i].match(/^\|\-(.*)/gi)) {
					// process rows
					endTd = '';

					// process attribues for row
					attr = tablesAttrCleanUp2html(line[0].substr(2, line[0].length), 'row');
					if (inTd) {
						endTd = "</td>";
						inTd = inTh = false;
					}
					if (inTh) {
						endTd = "</th>";
						inTh = inTd = false;
					}
					if (inTr) {
						lines[i] = endTd + "</tr><tr" + attr + ">";
					} else {
						lines[i] = endTd + "<tr" + attr + ">";
						inTr = true;
					}
				} else if ( ( line = lines[i].match(/^\|(.*)/gi) ) && inTable) {
					// process cells
					cellStart = 1 ;
					curLine = '';

					// check to see if cell row starts with '|' or '||' and remeber
					if (line[0].substr(1,1) == '|') cellStart = 2 ;

					// split the cell row into individual cells if there are any
					cells = line[0].substr(cellStart, line[0].length).split("||");

					// process the individual cells in the row
					for (var k = 0; k < cells.length; k++) {
						tdText = '';
						tdAttr = '';

						// remove an initial '|' if there is one 
						if (k > 0 && (cells[k].indexOf("|") === 0)) {
							cells[k] = cells[k].substr(1, cells[k].length);
						}

						// process the cell's attributes if any
						cont = cells[k].split("|");
						if (cont.length > 1) {
							// a pipe  within the cell content means it has attributes
							tempcont = new Array();
							for (var j = 1; j < cont.length; j++) {
								tempcont[j - 1] = cont[j];
							}
							tdText = tempcont.join("|");
							tdAttr = tablesAttrCleanUp2html(cont[0], 'cell');
						} else {
							tdText = cont[0];
						}

						//remember if the first line of the cell is empty
						if (tdText.match (/^\s*$/)) {
							cellEmptyLineFirst = 'true';
							tdText = '';
						} else {
							cellEmptyLineFirst = 'false';
						}

						if (!inTr) {
							inTr = true;
							curLine = "<tr class='mwt-silentTr' >" + curLine;
						}

						if (cellStart == 1)	{
							wikiPipe = '|' ;
						} else {
							wikiPipe = '||'	;					
						}

						if (cellStart > 0) {
							cellInLine = 'false' ;
						} else {
							cellInLine = 'true' ;
						}

						if (inTd) {
							curLine += "</td>";
						} else if ( inTh ) {
							curLine += "</th>";
							inTh = false;
							inTd = true;
						} else {
							inTd = true;
						}
						curLine += "<td" + tdAttr + " data-mwt-cellInline='" + cellInLine + "' data-mwt-cellEmptyLineFirst='" + cellEmptyLineFirst + "' data-mwt-wikiPipe='" + wikiPipe + "' >" + tdText;
						cellStart = -1;
						cellInLine = false;
						cellEmptyLineFirst = false;
						wikiPipe = '';						
					}
					lines[i] = curLine;
				} else if ( ( line = lines[i].match(/^\!(.*)/gi) ) && inTable) {
					// process headings, being sure to cater for when headings are on the 
					// same or separate lines
					cellStart = 1 ;
					curLine = '';

					// make note if header starts with one or two '||'s 
					if (line[0].substr(1,1) == '|') cellStart = 2 ;

					// split the line into one or more header cells
					cells = line[0].substr(cellStart, line[0].length).split("!!");

					// process each of the header cells found
					for (var k = 0; k < cells.length; k++) {
						tdText = '';
						tdAttr = '';

						if (k > 0 && (cells[k].indexOf("|") === 0)) {
							cells[k] = cells[k].substr(1, cells[k].length);
						}

						cont = cells[k].split("|");
						if (cont.length > 1) {
							// a pipe  within the cell content means it has attributes
							tempcont = new Array();
							for (var j = 1; j < cont.length; j++) {
								tempcont[j - 1] = cont[j];
							}
							tdText = tempcont.join("|");
							tdAttr = tablesAttrCleanUp2html(cont[0], 'cell');
						} else {
							tdText = cont[0];
						}

						// in mediwiki the row code can be infered so we note
						// that so we can rebuild the wiki code corrrectly later
						if (!inTr) {
							inTr = true;
							curLine = "<tr class='mwt-silentTr' >" + curLine;
						}

						// we use wikiPipe to record whether the cell started with 
						// a single or double character code
						if (cellStart == 1)	{
							wikiPipe = '!' ;
						} else {
							wikiPipe = '!!'	;					
						}

						// we use cellInLine to record if the headers are on the
						// same or different lines
						if (cellStart > 0) {
							cellInLine = 'false' ;
						} else {
							cellInLine = 'true' ;
						}

						// close off any open headers or cells before adding the
						// new header html
						if (inTh) {
							curLine += "</th>";
						} else if (inTd) {
							curLine += "</td>";
							inTd = false;
							inTh = true;
						} else {
							inTh = true;
						}

						// finally build the html for the header
						curLine += "<th" + tdAttr + " data-mwt-cellInline='" + 
							cellInLine + "' data-mwt-wikiPipe='" + 
							wikiPipe + "' >" + tdText;
						cellStart = -1;
					}

					// replace the original wiki code with the new html
					lines[i] = curLine;
				} else {
					// process line in cell without table markup
					if (inTd) {
						//process empty lines at start and end of cells
						if (emptyLine = lines[i].match(/^(\s|&nbsp;)*$/)) { 
							// if this is first line in cell
							if ( lines[i-1].match( /<td[^>]*>(\s|&nbsp;)*$/) ) {
								// if first line of data in a table cell
								// if the next line is not empty remove and set counter back one
								if ( lines[i + 1].match(/^(\s|&nbsp;)*$/)) {
									lines[i] = lines[i] + '{@@@ELF:0@@@}'; //0125
									lines.splice(i+1, 1); //0125
								} else { //0125
									lines.splice(i, 1); //0125
									i = i - 1;
								}
							}
						} else {
							// process non empty first line of data
							if ( lines[i-1].match( /^<td[^>]*>/) ) { //0125
								// previous line was start of cell
								if ( lines[i-1].match( /<td[^>]*>(\s|&nbsp;)*$/) ) {
									// previous line contained no data
//0914									lines[i-1] = lines[i-1] + '{@@@SLB:0@@@}';
								} else if ( !lines[i].match(blockMatcher) ) {
									// line  is not a block element
									lines[i-1] = lines[i-1] + '{@@@ENL:0@@@}';
								}
							}
						}
					}
				}
			}
			text = lines.join("\n");
			
			// fix any empty cells by putting in temporary <br>s
			text = text.replace(/<td([^>]*)>\n{0,1}<\/td>/gmi, "<td$1><br></td>");
			return text;
		}

		/**
		 * Converts MW lists to HTML
		 *
		 * @param {String} text
		 * @returns {String}
		 */
		function lists2html(text) {
			var lines = [],
				lastList = '',
				line = '',
				inParagraph = false,
				inBlock = false,
				matchStartTags = false,
				matchEndTags = false,
				emptyLine = false,
				lastLine = false,
				startTags = 0,
				endTags = 0,
				blockLineCount = 0,
				blockTagList,
				regex,
				matcher;

			/**
			 * Converts MW list markers to HTML list open tags
			 *
			 * @param {String} lastList
			 * @param {String} cur
			 * @returns {String}
			 */
			function openList2html( lastList, cur, spaces ) {
				var listTags = '';

				// firstly build list tag for the the overlap with last list if needed
				if (lastList !=  cur.slice( 0, lastList.length )) {
					listTags = continueList2html(  lastList, cur.slice( 0, lastList.length ), spaces );
				}

				for (var k = lastList.length; k < cur.length; k++) {
					switch (cur.charAt(k)) {
						case '*' :
							listTags = listTags + '<ul><li class="mwt-list" data-mwt-sameLine="false" data-mwt-spaces="' + spaces + '">';
							break;
						case '#' :
							listTags = listTags + '<ol><li class="mwt-list" data-mwt-sameLine="false" data-mwt-spaces="' + spaces + '">';
							break;
						case ';' :
							listTags = listTags + '<dl><dt class="mwt-list" data-mwt-sameLine="false" data-mwt-spaces="' + spaces + '">';
							break;
						case ':' :
							listTags = listTags + '<dl><dd class="mwt-list" data-mwt-sameLine="false" data-mwt-spaces="' + spaces + '">';
							break;
					}
				}
				return listTags;
			}

			/**
			 * Converts MW list markers to HTML list end tags
			 *
			 * @param {String} lastList
			 * @param {String} cur
			 * @returns {String}
			 */
			function closeList2html(lastList, cur) {
				var listTags = '';
				for (var k = lastList.length; k > cur.length; k--) {
					switch (lastList.charAt(k - 1)) {
						case '*' :
							listTags = listTags + '</li></ul>';
							break;
						case '#' :
							listTags = listTags + '</li></ol>';
							break;
						case ';' :
							listTags = listTags + '</dt></dl>';
							break;
						case ':' :
							listTags = listTags + '</dd></dl>';
							break;
					}
				}
				return listTags;
			}

			/**
			 * Converts MW list markers to HTML list item tags
			 *
			 * @param {String} lastList
			 * @param {String} cur
			 * @returns {String}
			 */
			function continueList2html(lastList, curList, spaces) {
				var listTags = '',
					lastTag = lastList.charAt(lastList.length - 1),
					curTag = curList.charAt(curList.length - 1),
					k;

				if (lastList === curList) {
					// this is a straighjtforward continuation of the previous list
					switch (lastTag) {
						case '*' :
						case '#' :
							listTags = '</li><li class="mwt-list" data-mwt-sameLine="false" data-mwt-spaces="' + spaces + '">';
							break;
						case ';' :
							listTags = listTags + '</dt><dt class="mwt-list" data-mwt-sameLine="false" data-mwt-spaces="' + spaces + '">';
							break;
						case ':' :
							listTags = '</dd><dd class="mwt-list" data-mwt-sameLine="false" data-mwt-spaces="' + spaces + '">';
							break;
					}
				} else {
					// the current list code differs from the previous one
					// so we need to work through the list code a character at a time
					// until they are the same
					k = lastList.length
					while (lastList.substring(0,k) != curList.substring(0,k)) {
						lastTag = lastList.charAt(k - 1)
						curTag = curList.charAt(k - 1)
						switch (lastTag) {
							case '*' :
								listTags = listTags + '</li></ul>';
								break;
							case '#' :
								listTags = listTags + '</li></ol>';
								break;
							case ';' :
								// if definition item
								if (curTag == ':') {
									listTags = listTags + '</dt>';
								} else {
									listTags = listTags + '</dt></dl>';
								}
								break;
							case ':' :
								if (curTag == ';') {
									listTags = listTags + '</dd>';
								} else {
									listTags = listTags + '</dd></dl>';
								}
								break;
						}
						k--;
					}
					do {
						// now add back the new list codes
						curTag = curList.charAt(k)
						switch (curTag) {
							case '*' :
								listTags = listTags + '<ul><li class="mwt-list" data-mwt-sameLine="false" data-mwt-spaces="' + spaces + '">';
								break;
							case '#' :
								listTags = listTags + '<ol><li class="mwt-list" data-mwt-sameLine="false" data-mwt-spaces="' + spaces + '">';
								break;
							case ';' :
								if ( lastTag == ':' ) {
									listTags = listTags + '<dt class="mwt-list" data-mwt-sameLine="false" data-mwt-spaces="' + spaces + '">';
								} else {
									listTags = listTags + '<dl><dt class="mwt-list" data-mwt-sameLine="false" data-mwt-spaces="' + spaces + '">';
								}
								break;
							case ':' :
								if ( lastTag == ';' ) {
									listTags = listTags + '<dd class="mwt-list" data-mwt-sameLine="false" data-mwt-spaces="' + spaces + '">';
								} else if (( lastTag == '*' ) || ( lastTag == '#' ) || ( lastTag == ':' )) {
									// close the previous lists and start a new definition list
									if (!lastList) {
										// on the same line
										listTags = listTags + '<dl><dd class="mwt-list" data-mwt-sameLine="true" data-mwt-spaces="' + spaces + '">';
									} else {
										// on a different line
										listTags = listTags + '<dl><dd class="mwt-list" data-mwt-sameLine="false" data-mwt-spaces="' + spaces + '">';
									}
								}
								break;
						}
						lastTag = curTag;
						k++;
					} while (k < curList.length); 
				}
				return listTags;
			}

			// make a regular expresion matcher to see if a line ends wtth a block element
			// this is used when walking through the editor content line by line.  We add
			// back PRE because it isn't in the block tag list as mediawiki treats them 
			// differently to how browsers do!

			//Walk through text line by line
			lines = text.split("\n");
			for (var i = 0; i < lines.length; i++) {
				// Prevent REDIRECT from being rendered as list.
				// Var line is only set if it is part of a wiki list
				line = lines[i].match(/^(\*|#(?!REDIRECT)|:|;)+/);
				lastLine = (i == lines.length - 1);
				//Process lines
				if (line && line !== '') { 
					// Process lines that are members of wiki lists,
					// reset the empty line count to zero as this line isn't empty
					// strip out the wiki code for the list element to leave just the text content

					lines[i] = lines[i].replace(/^(\*|#|:|;)*(\s*?)(\S.*?)$/gmi, function( match, $1, $2, $3) {//"$2");
						// $1 = wiki list coding
						// $2 = leading spaces
						// $3 = list content

						if (line[0].match(/^(\*|#)+:$/) ) {
							// If the line starts with something like '*:' or '#:'
							// then its probably a definition description within a list.
							return continueList2html(lastList, line[0], $2 ) + $3;
						} else if (line[0].indexOf(':') === 0) {
							// If the line belongs to a definition list starting with a ':' and
							// follows the last line of a sub, omit <li> at start of line.
							if (line[0].length > lastList.length) {
								return openList2html(lastList, line[0], $2 ) + $3;
							} else if (line[0].length === lastList.length) {
								return continueList2html(lastList, line[0], $2 ) + $3;
							} else if (line[0].length < lastList.length) {//close list
								return closeList2html(lastList, line[0], $2 ) + $3;
							}
						} else {
							//else if the line doesn't belong to a definition list starting with a ':' and follows
							//the last line of a sub list, include <li> at start of line
							if (line[0].length === lastList.length) {
								return continueList2html(lastList, line[0], $2 ) + $3;
							} else if (line[0].length > lastList.length) {
								return openList2html(lastList, line[0], $2 ) + $3;
							} else if (line[0].length < lastList.length) {
								// if moving back to higher level list from a sub list then 
								// precede line with a <li> or <dl> tag depending on the type of list
								if (line[0].charAt(line[0].length - 1) === ';') {
									return closeList2html(lastList, line[0], $2 ) + '<dt class="mwt-list" data-mwt-sameLine="false" data-mwt-spaces="' + $2 + '">' + $3;
								} else {
									return closeList2html(lastList, line[0], $2 ) + '<li class="mwt-list" data-mwt-sameLine="false" data-mwt-spaces="' + $2 + '">' + $3;
								}
							}
						}
					});
					if (line[0].charAt(line[0].length - 1) === ';') {
						// if it is a definition term, check to see if line
						// contains definition and process accordingly
						lines[i] = lines[i].replace(/:(\s*)/,function(match, $1){
							line[0] = line[0].substring(0,line[0].length - 1) + ':';
							return '</dt><dd class="mwt-list" data-mwt-sameLine="true" data-mwt-spaces="' + $1 + '">';
						});
					}
					inParagraph = true;
					// set lastlist as this will be used if the next line
					// is a list line to determine if it is a sublist or not
					lastList = line[0];
				} else {
					//else process lines that are not wiki list items
					//set emptyLine if line is empty
					emptyLine = lines[i].match(/^(\s|&nbsp;)*$/);
					if (emptyLine) {
						inParagraph = false;
					} else {
						// not an empty line
						inParagraph = true;
					}
					//Test if the previous line was in a list if so close that list
					if (lastList.length > 0) {
						lines[i - 1] = lines[i - 1] + closeList2html(lastList, '');
						lastList = '';
					}
				}
			}
			//Test if the previous line was in a list then
			//we will need to close the list
			if (lastList.length > 0) {
				lines[i - 1] = lines[i - 1] + closeList2html(lastList, '');
				lastList = '';
			}
			text = lines.join('\n');
			return text;
		}

		/**
		 * Converts empty lines to HTML
		 *
		 * @param {String} text
		 * @returns {String}
		 */
		function emptyLines2html(text) {
			var lines = [],
				lastList = '',
				line = '',
				inParagraph = false,
				inBlock = false,
				matchStartTags = false,
				matchEndTags = false,
				emptyLine = false,
				lastLine = false,
				startTags = 0,
				endTags = 0,
				blockLineCount = 0,
				blockTagList,
				regex,
				matcher;

			// make a regular expresion matcher to see if a line ends wtth a block element
			// this is used when walking through the editor content line by line.  We add
			// back PRE because it isn't in the block tag list as mediawiki treats them 
			// differently to how browsers do!

			blockTagList = _mwtBlockTagsList + '|' + _mwtPlainTextTagsBlock.join('|');
			blockTagList = _mwtBlockTagsList.split("|").join(":\\d*@@@}|{@@@") + ':\\d*@@@}'
				+ ':\\d*@@@}|{@@@ppre:\\d*@@@}';
			regex = '({@@@' + blockTagList 
					+ '|<' 
					+ _mwtBlockTagsList.split("|").join("[^>]*>|<") 
					+ '|<\\/' + _mwtBlockTagsList.split("|").join(">|<\\/") 
					+ '|<br[^>]*>|{@@@SLB:0@@@})$' ;
			matcher = new RegExp(regex, 'i');

			//Walk through text line by line
			lines = text.split("\n");
			for (var i = 0; i < lines.length; i++) {
					//else process lines that are not wiki list items
					//set emptyLine if line is empty
					emptyLine = lines[i].match(/^(\s|&nbsp;)*$/);
					if (emptyLine) {
						// process empty lines
						// If not already in a paragraph (block of blank lines)
						// process first empty line differently
						if (i == 0) {
							lines[i] = lines[i] + '{@@@ENL:0@@@}';
						} else if (!inParagraph) {
							lines[i] = lines[i] + '{@@@ENL:0@@@}';
						} else {
							// this is in a paragraph
							// use a dummy br as a placeholder if the previous line
							// contained an html block otherwise empty line first
							// uses matcher created outside of this loop!
							if ( lines[i-1].search(matcher) > -1 ) {
								// there is a special case where the previous line had
								// a table close with text on the same line which is
								// already closed with an empty line
								if ( lines[i-1].search(/<br class="mwt-emptyline" \/>$/) > -1 ) {
									lines[i] = lines[i] + '{@@@SLB:0@@@}';
								} else {
									if ( !lastLine) { 
										lines[i] = lines[i] + '{@@@SLB:0@@@}{@@@SLB:0@@@}';
									}
								}
							} else {
								lines[i] = lines[i] + '{@@@ELF:0@@@}';
							}
							inParagraph = false;
						}
					} else {
						// not an empty line
						inParagraph = true;
					}
			}

			text = lines.join('');
			return text;
		}


		/**
		 * Process new lines.  We covert to dom and process elements
		 * to avoid breaking paragraphs across elements.  Only applies to
		 * TH, TD and DIV elements as these can have P elements within them
		 *
		 * @param {String} text
		 * @returns {String}
		 */
		function newLines2html (text, mode) {
			var $dom,
				regex, 
				matcher,
				extensionTags,
				preservedTags,
				invariantTags;

			// single linebreaks are not rendered as such by the mediawikiparser
			// so we use a placeholder int the html intead
			function singleLinebreaks2html(text) {	
				var processFlag,
					postText,
					regex,
					matcher,
					regex2,
					matcher2,
					startTagsList,
					blockTagList,
					preservedTagList;
	
				// A single new line is not renderred as such by mediawiki unless 
				// it is preceded or followed by certain types of line. We need 
				// to pass text several times to be sure we got them all
	
				// a single new line followed by any line starting with an 
				// element in postText, possibly preceded by spaces, 
				// is rendered as a new line.  Basically this is any htmltag including
				// any already substitued with a place holder or wiki markup for headings,
				// tables and lists
				preservedTagList = _mwtPreservedTagsList + '|' + _mwtInvariantTagsList;
				startTagsList = _mwtBlockTagsList.split("|").join(":|{@@@");
				postText = "\\s*(\\n|\\||!|\\{\\||#|\\*|;|=|:|{@@@" 
					+ startTagsList 
					+ ":|\\s*$)"
					+ "|<\\/?" 
					+ _mwtBlockTagsList.split('|').join('[\\s>]|<\\/?') 
					+ preservedTagList.split('|').join('[\\s>]|<\\/?')
					+ "[\\s>]" 
					+ "(\\|\\}\\s*$|=\\s*$|<\\/span>\\s*$|^\\s*(#|\\*|:|;|\\|\\||\\|-|\\|\\}))";
	
				// remove any exceptions from the list of tags that are ignored
				postText = postText.replace(/:\|{@@@pre:/gmi, ""); // <pre> tags
				postText = postText.replace(/:\|{@@@h[1-6]/gmi, ""); // <h[n]> tags
	
				// cater for blank lines at start of text before blocks
				regex = '([^\\n]+)(\\n)(?!(' + postText + '))';
				matcher = new RegExp(regex, 'gi');
	
				// also set up the matcher for the inner match statement to avoid having to redefine it
				// every time the out matcher matches!
				blockTagList = _mwtBlockTagsList.split("|").join(":\\d*@@@}|{@@@");
				regex2 = "(\\|\\}\\s*$|=\\s*$|{@@@" 
					+ blockTagList + ":\\d*@@@}" 
					+ "|<\\/?" 
					+ _mwtBlockTagsList.split('|').join('[\\s>]|<\\/?') 
					+ "[\\s>]" 
					+ "|^\\s*(#|\\*|:|;|\\|\\||\\|-|\\|\\}))";
	
				// remove any exceptions from the list of tags that are ignored
				regex2 = regex2.replace(/\|<\\\/\?span\[\\s>\]/gmi, ""); // <span> tags
	
				matcher2 = new RegExp(regex2, 'i');
	
				// special case if page starts with a single new line
				text = text.replace(/^\n([^\n*#{]+)/, '{@@@SLB:0@@@}$1');
	
				// now process all single new lines
				do {
					processFlag = false;
					text = text.replace(matcher, function(match, $1, $2, $3, offset, string) {
						// $1 = the text preceding single new line
						// $2 = the single new line itself
						// $3 = any non-excluded text following the single new line 
	
						// if the line preceding the single new line doesn't end with any of the
						// folowing characters in a line or start with others then render as a new line
						if ($1.match(matcher2)){
							// ignore if the first line following starts with a block tag
							return match;
						} else {
							// insert placeholder for single new line if placeholder is defined
							processFlag = true;
							if (_slb) {
								return $1 + '{@@@SLB:0@@@}';
							} else {
								return $1 + ' ';
							}
						}
					});
				} while (processFlag);
	
				return text;
			}
	
			// two or more new lines indicate a paragraph in the wikitext
			function paragraphNewLines2html (text, mode) {
				// make a regular expresion matcher to see if a line ends wtth a block element
				// this is used when walking through the editor content line by line.  We add
				// back PRE because it isn't in the block tag list as mediawiki treats them 
				// differently to how browsers do!
				var blockTagList,
					regex,
					matcher,
					lineBefore;
				blockTagList = _mwtBlockTagsList + '|' + _mwtPlainTextTagsBlock.join('|'); 
				blockTagList = blockTagList.split("|").join(":\\d*@@@}|{@@@") 
					+ ':\\d*@@@}|{@@@ppre:\\d*@@@}';
				regex = '({@@@' + blockTagList 
						+ '|<' 
						+ _mwtBlockTagsList.split("|").join("[^>]*>|<") 
						+ '|<\\/' + _mwtBlockTagsList.split("|").join(">|<\\/") 
						+ '>|<br[^>]*>|{@@@SLB:0@@@})$' ;
				matcher = new RegExp(regex, 'i');

				// wrap pseudo blocks in a paragraph.  If the insert is inline the use 
				// <br> tags rather than <P> tags
				text = text.replace(/(^|\n)([^\n]+)\n\n(\n*)/gmi, function (match, $1, $2, $3) {
					// $1 = new line or start of text
					// $2 = text on line before start of paragraph
					// $3 = any empty lines after the empty line pair

					lineBefore = htmlDecode( $2 );
					if ($3) {
						$3 = $3.replace(/\n/gmi, '{@@@ENL:0@@@}');
						if ( mode == 'inline' ) {
							return $1 + $2 + '{@@@ELF:0@@@}' + $3;
						} else {
							return $1 + $2 + '</p><p class="mwt-paragraph">' + $3;
						}
					} else if ( lineBefore.search(matcher) > -1 ) {
						if ( mode == 'inline' ) {
							return $1 + $2 + '{@@@ELF:0@@@}';
						} else {
							return $1 + $2 + '<p class="mwt-paragraph"></p>';
						}
					}else {
						if ( mode == 'inline' ) {
							return $1 + $2 + '{@@@ELF:0@@@}';
						} else {
							return $1 + $2 + '{@@@ELF:0@@@}</p><p class="mwt-paragraph">';
						}
					}
				});
				
				// the start of the block will not be converted back to two
				// new lines so we give it a different class
				if ( mode != 'inline' ) {
					text = '<p class="mwt-notParagraph">' + text +'</p>';
				}
	
				return text;
			}

			function convertNewLines2html( elm, level, mode ) {
				// this processes all new lines in the wikitext
				// BEWARE recursive function
				var id,
					outerHtml,
					innerHtml,
					index = 0;

				elm.children().each( function ( index ) {
						convertNewLines2html ( $(this), level + '.' + index );
						index = index + 1;
					})

				if (( elm[0].tagName == 'TD' ) 
					|| ( elm[0].tagName == 'TH' )
					|| ( elm[0].tagName == 'DIV' )) {
					// process cells
					innerHtml = elm[0].innerHTML;
					if (( elm[0].tagName == 'TD' ) 
						|| ( elm[0].tagName == 'TH' )) {
							// cells that start n a new line should have
							// the initial new line removed as this has been 
							// stored in the TD tag
							innerHtml = innerHtml.replace(/^\n/, '');
						}
					innerHtml = singleLinebreaks2html( innerHtml ); 
					innerHtml = paragraphNewLines2html( innerHtml, mode );

					elm.prop( "innerHTML", innerHtml );
				}
			}
			
			// if the text start with a new line, save it
			text = text.replace(/^\n/, _slb);

			// we turn the text into a dom so that pragraphs do not occur across element boundaries
			$dom = $( "<div class='tinywrapper'>" + text + "</div>", "text/xml" );

			// process blocks containing parsed wiki text
			convertNewLines2html ( $dom, '0', mode );

			// get rid of any empty P blocks
			$dom.find( "p" ).replaceWith( function() {
				var elm = this,
					outerHtml = elm.outerHTML,
					innerHtml = elm.innerHTML;

				if ( innerHtml.match(/^(\s|&nbsp;)*$/)) {
					return '';
				} else {
					return outerHtml;
				}
			});

			// convert DOM back to html text
			text = htmlDecode ($dom[0].innerHTML);
			return text;
		}

		// start of function to convert wiki code to html
		// save some work, if the text is empty
		if (text === '') {
			return text;
		}
		
		// wrap the text in an object and send it to event listeners
		textObject = {text: text};
		$(document).trigger('TinyMCEBeforeWikiToHtml', [textObject]);
		text = textObject.text;

		// substitute {{!}} with | if text is part of template
		if ( _pipeText == '{{!}}' ) {
			text = text.replace(/{{!}}/gmi, "|");
		}
		// normalize line endings to \n
		text = text.replace(/\r\n/gmi, "\n");
		// cleanup linebreaks in tags except comments
		text = text.replace(/(<[^!][^>]+?)(\n)([^<]+?>)/gi, "$1$3");
		//
		// The next four conversions insert html into the text which
		// may becomne corrupted by later conversions so to be safe we
		// use placeholders which gets converted back to the html at
		// the end of the conversion process
		// convert and preserve wiki switches for recovery later
		text = preserveWikiTags4Html(text);
		// convert and preserve templates for recovery later
		text = preserveTemplates4Html(text);
		// convert and preserve links and images
		text = _preserveLinks4Html(text);
		// convert and preserve invariant html tags for recovery later
		text = preserveNonWikiTags4Html(text);
		// convert styles
		text = styles2html(text);
		// convert headings
		text = headings2html(text);
		// convert tables
		text = tables2html(text);
		// convert lists
		text = lists2html(text);
		// convert new lines
		text = newLines2html( text, mode );

		//replace remaining \n
		text = text.replace(/\n/gmi, "");
		//Write back content of preserved code to placeholders.
		text = _recoverTags2html(text);
		// wrap the text in an object to send it to event listeners
		textObject = {text: text};
		$(document).trigger('TinyMCEAfterWikiToHtml', [textObject]);
		text = textObject.text;
		return text;
	}

	/*
	 * Inserts content of the clipboard when it is copied from within
	 * the TinyMCE editor.
	 *
	 * @param {dom} dom
	 * @returns {dom}
	 */
	function _internalPaste( $dom ) {
		// if pasting a copy from the TinyMCE mediwaiki editor
		// walk through the dom element by element converting the
		// html to wiki text from the leaves up to the root

		// remove paragraps blocks containing only empty space
		$dom.find( "p" ).replaceWith( function() {
			var elm = this,
				innerHtml = elm.innerHTML;
				
			if ( innerHtml.match(/^(\s|&nbsp;)*$/) ) {						
				return '';
			} else {
				return elm;
			}
		});

		// process blocks containing parsed wiki text by creating placeholders
		// and adding these to the placeholder table
		$dom.find(".mwt-wikiMagic").each( function ( a ) {
			var elm = this,
				id = '{@@@' + elm.id + '@@@}';
									
			if (_tags4Wiki[id] == undefined ) {
				_tags4Wiki[id] = htmlDecode( elm.attributes[ "data-mwt-wikitext" ].value );
			}
		});

		return $dom;
	}

	/*
	 * Converts html content of the editor window to wiki code.
	 *
	 * @param {String} text
	 * @returns {String}
	 */
	function _convertHtml2Wiki( text ) {
		var textObject;

		/*
		 * Process HTML in DOM form converting tags to placeholders for
		 * wiki text equivalents
		 *
		 * @param {String} text
		 * @returns {String}
		 */
		function convertHtmlElements2Wiki( text ) {
			var $dom;

			// preprocess text before dom walkthrough
			// the tables plugin uses thead tags to identify headers whereas
			// mediawiki uses th tags in the body of the table.  This converts between the two

			// replace any data-mwt-attr attributes with their values
			function processStoredAttributes2Wiki( text ) {
				text = text.replace(/data-mwt-attr=('|")(.*?)\1/gmi, function(match, $1, $2) {
					// $1 = type of quoation mark
					// $2 = attribute string
					$2 = $2.replace(/\&amp;/gmi, '&');
					return $2;
				});
				// for some reason Tiny can place spurios spacess at the end of
				// table class names.  This should remove these.
				text = text.replace(/\s*class="(.*?)"/i, function (match,$1) {
					//$1 = the class name string
					return match.replace(/".*?"/i,'"' + $.trim($1) + '"');
				});
				return text;
			}

			// walk through dom from leaves to root converting elements to their
			// wiki equivalernts
			//BEWARE recursive
			function processElement2Wiki( elm, level ) {
				var id,
					outerHtml,
					innerHtml;
					
				function removeElementAttributes( elm ) {
					//remove additonal properties used by the wiki parser plugin
					elm.removeAttr( 'id' );
					elm.removeAttr( 'class' );
					elm.removeAttr( 'title' );
					elm.removeAttr( 'contenteditable' );
					elm.removeAttr( 'draggable' );
					elm.removeAttr( 'data-mwt-type' );
					elm.removeAttr( 'data-mwt-wikitext' );
					elm.removeAttr( 'data-mwt-sameline' );
					elm.removeAttr( 'data-mwt-spaces' )
				}

				// if this is a text node type then ignore
				if ( elm[0].nodeType == 3) return;
				
				// first deal with elements that need no further processing
				if (elm.hasClass( 'mwt-wikiMagic' )) {
					// process blocks containing parsed wiki text
					elm.replaceWith( function(a) {
						// substitute the wiki text and store in a placeholder
						var wikiText = htmlDecode( this.attributes[ "data-mwt-wikitext" ].value ),
							id = "{@@@MAGIC:" + createUniqueNumber() + "@@@}";

						if (elm.hasClass( 'mwt-template' )) {
							// protect pipe chracters within templates
							wikiText = wikiText.replace(/\|/gm,'{@@pc@@}');
						}

						_tags4Wiki[id] = wikiText;
						return id;
					});
				} else if (elm.hasClass( 'mwt-nonBreakingSpace' )) {
					// process html entities
					elm.replaceWith( function(a) {
						return '&amp;nbsp;';
					});
				} else if (elm.hasClass( 'mwt-emptylineFirst' )) {
					// process empty line first tags
					elm.replaceWith( function(a) {
						return '{@@elf@@}';
					});
				} else if (elm.hasClass( 'mwt-emptyline' )) {
					// process additional empty line tags
					elm.replaceWith( function(a) {
						return '{@@enl@@}';
					});
				} else if (elm.hasClass( 'mwt-singleLinebreak' )) {
					// process non rendering new lines
					elm.replaceWith( function(a) {
						return '{@@snl@@}';
					});
/*				} else if (elm.hasClass( 'reference' )
					|| elm.hasClass( 'comment' )) {
					// process reference/comment placeholders
					elm.replaceWith( function(a) {
						return '';
					});*/
				} else {

					if (elm.hasClass( 'mwt-ppre' )) {
						// reconstruct the pseudo pre by replacing new lines with new line followed by a space
						// do this before processing children else the new lines will be embedded in placeholders
						innerHtml = elm[0].innerHTML;
						outerHtml = elm[0].outerHTML;
						elm.prop( "innerHTML", '{@@bnl@@} ' + innerHtml.replace(/(<br[^>]*>)/gmi, '{@@enl@@} ') + '{@@bnl@@}');
					}

					if ( elm.children().length > 0) {
					// process all descendents before further processing
					// basically the outerhtml of each element will be 
					// converted and replaced with a placeholder for recovery later
					elm.children().each( function ( index ) {
							processElement2Wiki ( $(this), level + '.' + index )
						})
					}
					
					// remove classes left over from pasting parsed mw text
					elm.removeClass( 'mw-headline' );
					if ( elm.attr( 'class' ) == '' ) {
						elm.removeAttr( 'class' );
					}

					if ( _mwtPlainTextClasses.some( r => elm[0].className.split(' ').includes( r )) &&
						(elm[0].id != "_mce_caret")) {
						// process plain text elements
	
						var targetTagIDName = elm[0].attributes[ 'data-mwt-type'].value.toUpperCase(),
							targetTagName = elm[0].attributes[ 'data-mwt-type'].value.toLowerCase(),
							tagIDName = elm[0].attributes[ 'data-mwt-type'].value.toUpperCase(),
							tagName = elm[0].tagName.toLowerCase(),
							innerHtml,
							regex,
							matcher;

						removeElementAttributes( elm );
	
						innerHtml = elm[0].innerHTML;
						outerHtml = elm[0].outerHTML;
	
						// if there was a new line straight after the tag, put it back
						regex = '^(<' + tagName + '[^>]*>)';
						matcher = new RegExp(regex, 'gmi');
	
						if ( targetTagName == 'pnowiki' ) {
							// if this is a pseudo pre nowiki then place a space
							// before the tag
							targetTagName = 'nowiki';
							outerHtml = outerHtml.replace(/<pre/, ' <pre');
							regex = '^(\\{@@nl@@\\})?(\\s?)<(' + tagName + ')([^]*?)\n?<\\/\\3>$';
							matcher = new RegExp(regex, 'gmi');
							outerHtml = outerHtml.replace( matcher, '{@@bnl@@}$2<' + targetTagName + '$4</' + targetTagName + '>{@@bnl@@}'); //0120
						} else if ( targetTagName == 'comment' ) {
							// beware comments are double wrapped
							if ( innerHtml.match(/^{@@@PRE:\d*@@@}$/)) {
								outerHtml = innerHtml;
							} else {
								outerHtml = '<!--' + innerHtml + '-->';
							}
						} else {
							// where a different tag was substituted for a wiki only tag then restore the 
							// wiki tag.  Remove any new lines inserted by mediawiki at end of pseudo pre nowikis
							regex = '^(\\{@@nl@@\\})?(\\s?)<(' + tagName + ')([^]*?\n?)<\\/\\3>$';
							matcher = new RegExp(regex, 'gmi');
							outerHtml = outerHtml.replace( matcher, '$2<' + targetTagName + '$4</' + targetTagName + '>');
						}
	
						// convert any br and slb to placeholders
						outerHtml = outerHtml.replace(/<br .*?class=("|')mwt-emptyLine\1.*?>/gmi, '{@@enl@@}');
						outerHtml = outerHtml.replace(/<span[^>]*mwt-singleLinebreak.*?<\/span>/gmi, '{@@enl@@}');
							
						//remove any unwanted data attributes
						outerHtml = outerHtml.replace(/data-mce-[^=]*?=\s*("|')[^\1]*?\1\s*/gmi, '');
						outerHtml = outerHtml.replace(/data-mwt-[^=]*?=\s*("|')[^\1]*?\1\s*/gmi, '');
	
					} else if ( elm.hasClass( 'mwt-dummyReference' )) {
						// spans with class mwt-dummyRference are replaced with their innerHTML

						outerHtml = $.trim( elm[0].innerHTML );
						if ( outerHtml == '' ) outerHtml = translate( 'tinymce-empty-reference' );

					} else if ( elm.hasClass( 'mwt-reference' )) {
						// spans with class mwt-reference are coverted to mediawiki <ref>

						outerHtml = $.trim( elm[0].innerHTML );
						if ( outerHtml == '' ) outerHtml = translate( 'tinymce-empty-reference' );
						outerHtml = '<ref>' + elm[0].innerHTML + '</ref>';

					} else if ( elm.hasClass( 'mwt-referenceHolder' )) {
						// spans with class mwt-reference are coverted to mediawiki <ref>

						outerHtml = elm[0].innerHTML;

					} else if ( elm.hasClass( 'mwt-commentHolder' )) {
						// spans with class mwt-reference are coverted to mediawiki <ref>

						outerHtml = elm[0].innerHTML;

					} else if ( elm[0].tagName == 'TBODY' ) {
						// tbody tags aren't recognised by mediawiki so replace with contents
						var tagNewline = '',
							tagSpaces = '';

						// set up newlines and spaces if required (for embedded html block tags)
						if (typeof elm.attr('data-mwt-sameLine') != "undefined") {
							if (elm.attr('data-mwt-sameLine') == 'false') tagNewline = '{@@bnl@@}';
						}
						if (elm.attr('data-mwt-spaces')) tagSpaces = elm.attr('data-mwt-spaces');
						outerHtml = tagNewline + tagSpaces + elm[0].innerHTML;

 					} else if ( elm.hasClass( 'mwt-preserveHtml' )) {
						// process html that should be preserved in wiki text
						// tries to reproduce any structural formatting in the wikitext
						var outerHtml,
							tagNewline = '',
							tagSpaces = '',
							newLineAfter = '';
							
						// clean up spurious spans left by template plugin
						if ( elm.hasClass( 'selectedcontent' )) {
							outerHtml = elm[0].innerHTML;
						} else {
							// set up newlines and spaces if required (for embedded html block tags)
							if (typeof elm.attr('data-mwt-sameLine') != "undefined") {
								if (elm.attr('data-mwt-sameLine') == 'false') tagNewline = '{@@bnl@@}';
							}
							if (elm.attr('data-mwt-spaces')) tagSpaces = elm.attr('data-mwt-spaces');
							if ( elm[0].nextSibling == null ) {
							} else if (elm[0].nextSibling.nodeName == "#text" ) {
								if (elm[0].nextSibling.textContent.match(/^\s*$/)) {
								}
							} else if ( editor.dom.isBlock( elm[0] ) ) {
									newLineAfter = '{@@bnl@@}';
							}

							elm.removeClass( 'mwt-paragraph' );
							elm.removeClass( 'mwt-preserveHtml' );
							elm.removeClass( 'mw-headline' );
							elm.removeAttr( 'data-mwt-sameLine' );
							elm.removeAttr( 'data-mwt-spaces' );
							if ( elm.attr( 'class' ) == '' ) {
								elm.removeAttr( 'class' );
							}

							// clean up any double encoded &amp; in html enitity titles
							if ( elm[0].title ) {
								elm.prop( "title", elm[0].title.replace(/&(\w*?|#[0-9]{3});/gmi, '{@@_@@}amp;$1;' ));
							}
							
							// replace element with converted text
							outerHtml = tagNewline + tagSpaces + _recoverPlaceholders2Wiki( elm[0].outerHTML ) + newLineAfter;
						}

					} else if ( elm[0].tagName == 'IMG' ) {
						// process images that aren't links

						outerHtml = elm[0].innerHTML 
						if (elm[0].parentNode.tagName != "A") {
							outerHtml = _getWikiImageLink( elm[0] );
						}

					} else if ( elm[0].tagName == 'A' ) {
						// process links
						var aLink,
							protocol = elm[0].protocol,
							dstName = elm[0].href,
							title = elm[0].text;

						if (elm[0].firstElementChild && elm[0].firstElementChild.tagName == "IMG") {
							// process links to images
							aLink = _getWikiImageLink(elm[0].firstElementChild, dstName);
						} else if (protocol) {
							// process external links
							if (title) {
								dstName = dstName + ' ' + title;
							}
							aLink = '[' + dstName + ']'
						} else {
							// process internal links
							if (title) {
								dstName = dstName + '|' + title;
							}
							aLink = '[[' + dstName + ']]'
						}

						outerHtml = aLink;

					} else if ( elm[0].tagName == 'BR' ) {
						// remove 'bogus' br tags inserted by the editor
						outerHtml = elm[0].outerHTML 
						if ( elm.attr('data-mce-bogus') == 1 ) {
							outerHtml = '';
						} else {
//1101							outerHtml = '{@@enl@@}'; 
						}
					} else if (( elm[0].tagName == 'LI' )
							|| ( elm[0].tagName == 'DD' )
							|| ( elm[0].tagName == 'DT' )
							) {
						// process list elements
						var parents = elm.parents("ul,ol,dl,dd"),
							listTag = '',
							html = '',
							outerHTML,
							tagNewline = '',
							newLineAfter = '{@@bnl@@}',
							tagSpaces = '';

						// if this is a table in a definition then remove
						// the new line before the table
						// if this item isn't empty (eg starts with a block new line
						if ( !elm[0].classList.contains( 'mwt-preserveHtml' )) {
							// case where tag inserted in TinyMCE editor
							var temp = elm[0].innerHTML;
//							if ( !elm[0].innerHTML.match(/^&lt;@@@(LI|DD):/) ) {
							if ( !elm[0].innerHTML.match(/^{@@@(LI|DD):/) ) {
								// build the wiki text list tag
								for (var i = parents.length - 1; i >= 0; i--) {
									if ( !parents[i].classList.contains( 'mwt-preserveHtml' )) {
										if ( parents[i].tagName == "UL" ) {
											listTag = listTag + '*';
										} else if ( parents[i].tagName == "OL" ) {
											listTag = listTag + '#';
										} else if ( parents[i].tagName == "DL" ) {
											if ( elm[0].tagName == 'DD' ) {
												if ( elm.attr('data-mwt-sameLine') == 'true' ) {
													listTag = listTag + ' :';
													// if dd is inline then skip further processing;
													i = 0;
												} else {
													listTag = listTag + ':';
												}
											} else if ( elm[0].tagName == 'DT' ) {
												listTag = listTag + ';';
											}
										} else if ( parents[i].tagName == "DD" ) {
											// nested in a dd so  prefix tag with :
											listTag =  ':' + listTag;
											if ( i > 0 ) {
												if ( parents[ i - 1 ].tagName == "DL" ) {
													// skip the dl tag
													i = i - 1;
												}
											}
										}
									}
								}
								// in the case of a DT only, it can be followed by a DD
								// on te same line so in that case don't put a new line after
								if ( elm[0].tagName != 'DT' ) {
								} else if ( elm[0].nextSibling == null ) {
								} else if ( elm[0].nextSibling.tagName != 'DD' ) {
								} else if ( elm[0].nextSibling.attributes['data-mwt-sameLine'] == undefined ) {
								} else if ( elm[0].nextSibling.attributes['data-mwt-sameLine'].value != 'false' ) {
									newLineAfter = ''
								}

								if ( typeof elm.attr('data-mwt-sameLine') == "undefined" ) {
									if ( elm[0].previousSibling == null ) {
										tagNewline = '{@@nl@@}';
									} else {
										tagNewline = '{@@bnl@@}';										
									}
								} else {
									if ( elm.attr('data-mwt-sameLine') == 'false' ) tagNewline = '{@@bnl@@}';
								}

								if ( elm.attr('data-mwt-spaces')) tagSpaces = elm.attr('data-mwt-spaces') ;
								html = tagNewline + listTag + tagSpaces + elm[0].innerHTML + newLineAfter;
							} else {
								// ignore empty list items
								html = elm[0].innerHTML;
							}
							outerHtml = html; 
						} else {
							// case where tag is being pasted from somewhere else
							outerHtml = elm[0].outerHTML;
						}
					} else if (( elm[0].tagName == 'OL')
							|| (elm[0].tagName == 'UL')
							|| (elm[0].tagName == 'DL')
							) {
						var innerHtml = elm[0].innerHTML;
						// replace ul and ol and dl tags with their contents
						// as they don't exist in wiki text separately to list items

						// if no children of type list then this is a wiki list
						// so just return the innerHtml
						if ( !innerHtml.match(/^s*?{@@@(PLI|PDD):/)) {
							elm.replaceWith( function(a) {
								return innerHtml;
							});
							return;
						} else {
							// case where tag is being pasted from somewhere else
							outerHtml = elm[0].outerHTML;
						}

					} else if ( elm[0].tagName.match(/^H\d$/) ) {
						// process headings
						var headingMarkup = '======',
							text = elm[0].innerText,
							hLevel = elm[0].tagName.substring(1),
							spacesBefore = elm[0].getAttribute("data-mwt-headingSpacesBefore"),
							spacesAfter = elm[0].getAttribute("data-mwt-headingSpacesAfter"),
							newlines = elm[0].getAttribute("data-mwt-headingNewLines"),
							altro = headingMarkup.substring(0, hLevel),
							heading;

						spacesBefore = spacesBefore ? spacesBefore : ' ';
						spacesAfter = spacesAfter ? spacesAfter : ' ';
						newlines = newlines ? newlines : 0;

						// mediawiki doesn't like leading and trailing new lines
						text = text.replace(/{@@elf@@}/gm, "\n\n");
						text = text.replace(/{@@enl@@}/gm, "\n");
						text = text.replace(/{@@snl@@}/gm, "\n");
						text = text.replace(/^(\n*)([^]*?)(\n*)$/, function (match, $1, $2, $3) {
							// $1 = new lines before
							// $2 = heading text
							// $3 = new lines after
							
							// build the header, including any spaces before the header text
							$2 = $2.replace(/\/n/gmi, '<br>');
							heading = altro + spacesBefore + $2 + spacesAfter + altro ;
							heading = '{@@hnl@@}' + heading + '{@@hnl@@}';
							// build back any new lines after the heading
							for (var i = 0; i < newlines; i++) {
								heading += '{@@nl@@}';
							}
							$1 = $1.replace(/\n/gm, '{@@nl@@}');
							$2 = $2.replace(/\n/gm, '{@@nl@@}');
							return $1 + heading + $3;
						});
						outerHtml = text;
						
					} else if ( elm[0].tagName == 'TABLE' ) {
						// now process code at start and end of tables.  Note the new line handling for these
						// happens when all the other new line codes are processed in newLines2wiki
						var parents = elm.parents( "table" ),
							outerHtml = elm[0].outerHTML,
							newLineBefore = '{@@tnl@@}',
							newLineAfter = '{@@tnl@@}';

						// if the table is in a definition item then don't place a new line before it
						if ( elm[0].parentElement.tagName.toUpperCase() == 'DD' ) {
							newLineBefore = '';
						}

						outerHtml = outerHtml.replace(/^<table([^>]*)>([^<]*)<\/table>$/i, function (match, $1, $2) {
							// $1 = any attributes contained in the tag
							// $2 = content of the tag
							var newLines = '';
							// process the empty lines at the start of the table
							$1 = $1.replace(/\s*data-mwt-tablestartnewlines="(\d)"/gmi, function (match,$1) {
								//$1 = number of new lines following the opening code of table
								for ( var i = 1 ; i < $1 ; i++ ) {
									newLines += "{@@tnl@@}";
								}
								return '';
							});

							// process other attributes
							$1 = processStoredAttributes2Wiki( $1 );
							// if this table is nested in another or there is text on
							// the same line as the table closure, then no new line after
							if ( elm[0].nextSibling != null ) {
								if ( elm[0].nextSibling.className != undefined ) {
									if ( elm[0].nextSibling.className.indexOf( 'mwt-closeTable' ) > -1 ) {
										newLineAfter = '';
									}
								}
							}
							if ( parents.length >= 1 ) {
								newLineAfter = '';
							}
							return newLineBefore + "{" + _pipeText + $1 + newLines + $2 + "{@@tnl@@}" + _pipeText + "}" + newLineAfter;
						});

					} else if ( elm[0].tagName == 'CAPTION' ) {
						// process table captions
						var outerHtml = elm[0].outerHTML;
						
						outerHtml = outerHtml.replace(/^<caption([^>]*)>([^<]*)<\/caption>$/i, function(match, $1, $2) {
							// check to see if there are attributes.  If there are, place these
							// before the a pipe in the caption line
							// $1 = attributes of the tag
							// $2 = content of the tag
							// process other attributes
							$1 = processStoredAttributes2Wiki( $1 );
							if ($1) {
								return "{@@tnl@@}" + _pipeText + "+ " + $1 + _pipeText + $2;
							} else {
								return "{@@tnl@@}" + _pipeText + "+ " + $2;
							}
						});

					} else if ( elm[0].tagName == 'TR' ) {
						// process table rows
						var outerHtml = elm[0].outerHTML;

						outerHtml = outerHtml.replace(/^<tr([^>]*)>([^<]*)<\/tr>$/i, function(match, $1, $2) {
							// $1 = attributes of tag
							// $2 = content of the tag
							if ($1.match(/mwt-silentTr/gmi)) {
								// silent TRs aren't rendered in wikicode
								return $2;
							}
							if ($1.match(/^\s*$/gmi)) {
								// attributes string that is just spaces should be made empty
								$1 = '';
							}
							// process other attributes
							$1 = processStoredAttributes2Wiki( $1 );
							return "{@@tnl@@}" + _pipeText + "-" + $1 + $2;
						});

					} else if ( elm[0].tagName == 'TH' ) {
						// process table headings
						var outerHtml = elm[0].outerHTML;
						
						outerHtml = outerHtml.replace(/\n?<th([^>]*)>(\s*)([^<]*?)(\s*)<\/th>$/i, function (match, $1, $2, $3, $4 ) {
							// $1 = any html attributes of the header
							// $2 = spaces before content of the tag
							// $3 = content of the tag
							// $4 = spaces at end of content of the tag
							var cellPipeText = '!',
								cellNewLine = '{@@tnl@@}',
								cellEmptyLineFirst = '';

							$1 = $1.replace(/ data-mwt-wikiPipe\="(.*?)"/gmi, function (match, $1) {
								if ($1 == '!!') {
									cellPipeText += cellPipeText;
									if ( $4 == '' ) cellPipeText = ' ' + cellPipeText;
								}
								return "";
							});

							$1 = $1.replace(/ data-mwt-cellInline\="(.*?)"/gmi, function (match, $1) {
								if ($1 == 'true') {
									cellNewLine = "";
								} else {
									cellNewLine = "{@@tnl@@}";
								}
								return "";
							});

							$1 = $1.replace(/ data-mwt-cellEmptyLineFirst\=("|')(.*?)\1/gmi, function (match, $1, $2) {
								// $1 = type of quotation mark
								// $2 = the value of the parameter
								if ($2 == 'false') {
									cellEmptyLineFirst = "";
								} else {
									cellEmptyLineFirst = "{@@tnl@@}";
								}
								return "";
							});

							// process other attributes
							$1 = processStoredAttributes2Wiki( $1 );

							// always have at least one space before cell content unless empty first line
							if (($2 == '' ) && (!cellEmptyLineFirst )) $2 = ' ';
							if ($1) {
								return cellNewLine + cellPipeText + $1 + ' ' + _pipeText + cellEmptyLineFirst + $2 + $3;
							} else {
								return cellNewLine + cellPipeText + cellEmptyLineFirst + $2 + $3;
							}
						});

					} else if ( elm[0].tagName == 'TD' ) {
						// process table cells
						var outerHtml,
							innerHtml = elm[0].innerHTML;
														
						innerHtml = innerHtml.replace(/^(\s*)&nbsp;(\s*)$/, '$1$2');
						innerHtml = innerHtml.replace(/^{@@@BR:\d*@@@}$/, '\n');
						elm.prop( "innerHTML", innerHtml );
						
						outerHtml = elm[0].outerHTML;
						outerHtml = outerHtml.replace(/^<td([^>]*?)>(\s*)([^<]*?)<\/td>$/i, function (match, $1, $2, $3 ) {
							// $1 = any attributes associated with the cell
							// $2 = spaces before content of the tag
							// $3 = content of the tag
							var cellPipeText = _pipeText,
								cellNewLine = '{@@tnl@@}',
								cellEmptyLineFirst = '';

							// process the pipe text
							$1 = $1.replace(/ data-mwt-wikiPipe\="(.*?)"/gmi, function (match, $1) {
								if ($1 == '||') {
									cellPipeText += _pipeText;
								}
								return "";
							});

							// process if inline or not
							$1 = $1.replace(/ data-mwt-cellInline\="(.*?)"/gmi, function (match, $1) {
								if ($1 == 'true') {
									cellNewLine = "";
								} else {
									cellNewLine = "{@@tnl@@}";
								}
								return "";
							});

							$1 = $1.replace(/ data-mwt-cellEmptyLineFirst\=("|')(.*?)\1/gmi, function (match, $1, $2) {
								// $1 = type of quotation mark
								// $2 = the value of the parameter
								if ($2 == 'false') {
									cellEmptyLineFirst = "";
								} else {
									cellEmptyLineFirst = "{@@tnl@@}";
								}
								return "";
							});

							// process other attributes
							$1 = processStoredAttributes2Wiki( $1 );

							// always have at least one space before cell content unless empty first line
							if (($2 == '' ) && (!cellEmptyLineFirst )) $2 = ' ';

							if ($1) {
								return cellNewLine + cellPipeText + $1 + ' ' + _pipeText + cellEmptyLineFirst + $2 + $3;
							} else {
								return cellNewLine + cellPipeText + cellEmptyLineFirst + $2 + $3;
							}
						});

					} else if (elm.hasClass( 'mwt-closeTable' )) {
						// process stuff after table close on the same line
						var outerHtml = elm[0].outerHTML,
							innerHtml = elm[0].innerHTML,
//							id = "{@@@" + elm[0].tagName.toUpperCase() + ":" + createUniqueNumber() + "@@@}",
							tableClose = '';

						outerHtml = outerHtml.replace(/mwt-spaces="(.*?)"/gi,
							function(match, $1, $2, $3) {
								// $1 = spaces following close table on the same line
								// $2 = text following close table on the same line

								innerHtml = $1 + innerHtml;

								return '';
						});

						outerHtml = innerHtml;

					} else if ( elm[0].tagName == 'STRONG' ) {
						// process strong text

						outerHtml = elm[0].outerHTML;

						outerHtml = outerHtml.replace(/<strong>(.*?)<\/strong>/gmi, "'''$1'''");

					} else if ( elm[0].tagName == 'B' ) {
						// process strong text
						outerHtml = elm[0].outerHTML;
						outerHtml = outerHtml.replace(/<b>(.*?)<\/b>/gmi, "'''$1'''");

					} else if ( elm[0].tagName == 'EM' ) {
						// process strong text
						var outerHtml = elm[0].outerHTML,
							innerHtml =  elm[0].innerHTML;
						// TinyMCE copy/cut sometimes nests EMs in EMs so fix here for paste
						if (elm[0].parentNode.tagName == "EM") {
							outerHtml = innerHtml;
						} else {
							outerHtml = outerHtml.replace(/<em>(.*?)<\/em>/gmi, "''$1''");
						}

					} else if ( elm[0].tagName == 'I' ) {
						// process strong text
						var outerHtml = elm[0].outerHTML;
						outerHtml = outerHtml.replace(/<i>(.*?)<\/i>/gmi, "''$1''");

					} else if ( elm[0].tagName == 'STRIKE' ) {
					// process strong text
						var outerHtml = elm[0].outerHTML;
						outerHtml = outerHtml.replace(/<strike>(.*?)<\/strike>/gi, "<s>$1</s>");

					} else if ( elm[0].tagName == 'SPAN' ) {
						innerHtml = elm[0].innerHTML;
						outerHtml = elm[0].outerHTML;
						if ( elm[0].id == '_mce_caret' ) {
						 	// spans with id _mce_caret are replaced with their innerHTML
							outerHtml = innerHtml;
						} else if ( innerHtml == '&nbsp;' ) {
							// likewise spans containing only nbsp
//0205							outerHtml = innerHtml;
							if (elm[0].attributes.length == 0 ||
								elm[0].classList.length == 0 ||
								elm[0].style == '') {
								outerHtml = ' ';
							} else {
								outerHtml = innerHtml;
							}
						}
					} else if ( elm[0].tagName == 'PRE' ) {
						// process spans containing only nbsp
						innerHtml = elm[0].innerHTML;
						outerHtml = elm[0].outerHTML;
						if (elm.hasClass( 'mwt-ppre' )) {
							// reconstruct the pseudo pre 
//							outerHtml = innerHtml.replace(/{@@nl@@}/gmi, '{@@nl@@} ');
							outerHtml = innerHtml;
						}

					} else if (( elm[0].tagName == 'DIV' ) || ( elm[0].tagName == 'P' )) {
						var html,
							outerHtml = elm[0].outerHTML,
							innerHtml = elm[0].innerHTML,
							indentation = editor.getParam( "indentation" ).replace(/px/i, ""),
							indented = editor.dom.getStyle( elm[0], "margin-left").replace(/px/i, ""),
							tabChars = "::::::::::::::::::::::::::::",
							tabs,
							tabStops = '';
							
						if ((indented > 0) && ( indentation > 0)) {
							tabs = Math.round( indented / indentation );
							tabStops = tabChars.substr( 0, tabs) ;
						}
							
						innerHtml = tabStops + innerHtml;

						if ( innerHtml.match(/^(\s|&nbsp;|\{@@nl@@})*$/)) {
							// remove empty P's and DIV's created by TinyMCE and this plugin
							outerHtml = '';
						} else if (elm.hasClass( 'mwt-paragraph' )) {
							// if copying from TinyMCE process paragraph tags 
							if ( innerHtml == '&nbsp;' ) {
								outerHtml  = '{@@pnl@@}';
							} else {
//								outerHtml  = '{@@pnl@@}' + $.trim( elm.html() );
								outerHtml  = '{@@pnl@@}' + $.trim( innerHtml );
							}
						} else if ( elm.hasClass( 'mwt-notParagraph' ) ||
							elm.hasClass( 'tinywrapper' )) {
							// not paragraph or tinywrapper means it has no new lines before it
//0701							outerHtml  = $.trim(elm.html()) + '{@@pnl@@}';
							outerHtml  = $.trim( innerHtml ) + '{@@npl@@}';
						} else if ( elm.hasClass( 'mw-references-wrap' ) ) {
							// not paragraph or tinywrapper means it has no new lines before it
							outerHtml  = '<references />';
						}
					} else {
						// treat everything else as preserved html
						outerHtml = elm[0].outerHTML;	
					}

					// create a place holder for the converted element
					id = "{@@@" + elm[0].tagName.toUpperCase() + ":" + createUniqueNumber() + "@@@}";
					
					//remove any unwanted data attributes
					outerHtml = outerHtml.replace(/data-mce-[^=]*?=\s*("|')[^\1]*?\1\s*/gmi, '');
					outerHtml = outerHtml.replace(/data-mwt-[^=]*?=\s*("|')[^\1]*?\1\s*/gmi, '');

					// insert placeholder
					_tags4Wiki[id] = outerHtml;
					elm.replaceWith( function(a) {
						return id;
					});
				}
			};

			// save time if no html in text
			if (( text === '') || (!text.match(/</)) ) return text;

			text = "<div class='tinywrapper'>" + text + "</div>";

			var dom = $( text );
			
			// walk through the dom element by element converting the
			// html to wiki text from the leaves up to the root

			// process blocks containing parsed wiki text
			processElement2Wiki ( dom, '0' );

			// convert DOM back to html text
			text = htmlDecode (dom[0].innerHTML);

			// remove non-breaking space after ||
			text = text.replace(/\|\|&nbsp;/gi, _pipeText + _pipeText);

			// clean up newline before images
			// do it here before placeholders are converted back
			text = text.replace(/{@@pnl@@}({@@@IMAGE:)/gmi, '$1');
			return text;
		}
		/**
		 * replaces placeholders with their wiki code equivalent
		 *
		 * @param {String} text
		 * @returns {String}
		 */
		function recoverTags2Wiki(text) {
			if (_tags4Wiki){
				while (text.match(/\{@@@.*?:\d*@@@}/)) {
					text = text.replace(/(\{@@@.*?:\d*@@@})/gi, function(match, $1, offset, text) {

						// '&amp;' is processed by the wiki don and turned into '&'
						// so we subsitue it with a placeholder which will be replaced later
						if ( _tags4Wiki[$1] != undefined) {
							return _tags4Wiki[$1].replace(/&amp;/gmi,'{@@_@@}');
						} else {
							return '### ' + $1.replace(/@@@}/gmi,'&#125;').replace(/{@@@/gmi,'&#123;') + ' not found ###';;
						}
					});
				}
			}
			return text;
		}

		/**
		 * this rationalises all the different new line placeholders to '\n's
		 *
		 * @param {String} text
		 * @returns {String}
		 */
		function newLines2wiki (text) {
			var regex,
				findText;
// DC TODO tidy this up/rationalise when satisfied it is OK
			// protect any new lines embedded in the html
			text = text.replace(/\n(?!{@@enl@@})/gmi, "{@@enl@@}"); //0907
			
			// process any multiple block new lines
			text = text.replace(/({@@bnl@@})+/gmi, '{@@bnl@@}');
			
			// protect any pre blocks followed by pnl
//0126			text = text.replace(/<\/pre>{@@pnl@@}/gmi, "</pre> ");
			
			// process single new lines bracketed by block new lines
//1019			text = text.replace(/({@@[epbht]nl@@})*(\s*{@@snl@@}\s*)/gmi, "$2");
			text = text.replace(/({@@[epbht]nl@@}\s*)*(\s*{@@snl@@}\s*)/gmi, "$2");
//0914			text = text.replace(/(\s*{@@snl@@}\s*)({@@[pbht]nl@@})*/gmi, function(match, $1, $2, $3, $4) {
//0914				return $1;
//0914			});
//0102			text = text.replace(/(\s*{@@snl@@}\s*)({@@[pbht]nl@@})*/gmi, "$1");
			text = text.replace(/(\s*{@@snl@@}\s*)({@@[pbht]nl@@})+/gmi, "$2");
			// process empty lines bracketed by block new lines
//0914			text = text.replace(/({@@[pbht]nl@@})?((\s*{@@(enl|elf)?@@}\s*)+)({@@[pbht]nl@@})?/gmi, "$2");
			text = text.replace(/({@@([bht]nl|npl)@@})?{@@pnl@@}{@@enl@@}{@@[bht]nl@@}/gmi, "{@@nl@@}{@@nl@@}{@@nl@@}"); //0115
			text = text.replace(/{@@tnl@@}{@@elf@@}{@@npl@@}{@@bnl@@}/gmi, "{@@nl@@}{@@nl@@}{@@nl@@}"); //0126
			text = text.replace(/({@@[bht]nl@@})*((\s*{@@(enl|elf)?@@}\s*)+)({@@[bht]nl@@})*/gmi, "$2"); //0907a
			text = text.replace(/({@@[p]nl@@})((\s*{@@(enl|elf)?@@}\s*)+)({@@[p]nl@@})/gmi, "$2"); //0907a
//0916			text = text.replace(/({@@pnl@@})({@@[bht]nl@@})/gmi, "$1"); //0907a
//0114			text = text.replace(/({@@pnl@@})({@@[bht]nl@@})*/gmi, "$1"); //0916
//0202			text = text.replace(/({@@pnl@@})({@@[bht]nl@@})+/gmi, "$2"); //0114
			text = text.replace(/({@@pnl@@})({@@[bht]nl@@})/gmi, "$2"); //0114
//0202			text = text.replace(/({@@npl@@})({@@[bht]nl@@})+/gmi, "$2"); //0118
			text = text.replace(/({@@npl@@})({@@[bht]nl@@})/gmi, "$2"); //0118
//0115			text = text.replace(/({@@[bht]nl@@})({@@pnl@@})+/gmi, "$1"); //0115
//0115			text = text.replace(/({@@[bht]nl@@})({@@pnl@@})+/gmi, "$2"); //0115
			text = text.replace(/({@@[bht]nl@@})({@@pnl@@})+({@@enl@@})/gmi, "{@@nl@@}{@@nl@@}{@@nl@@}"); //0115
			text = text.replace(/({@@npl@@})({@@pnl@@})+({@@enl@@})/gmi, "{@@nl@@}{@@nl@@}{@@nl@@}"); //0119
			text = text.replace(/({@@[bht]nl@@})({@@pnl@@})+/gmi, "$1"); //0115
//0115			text = text.replace(/({@@pnl@@})({@@enl@@})*/gmi, "$1"); //1030
//0119			text = text.replace(/({@@pnl@@})({@@enl@@})+/gmi, "$2"); //0115
			text = text.replace(/({@@npl@@})({@@enl@@})+/gmi, "$2"); //0118
			// process tables with separate cells on same line separated by '||'
			text = text.replace(/({@@npl@@})\|\|/gmi, " ||"); //0118
			text = text.replace(/({@@elf@@}\s*)({@@(npl|pnl)@@})*/gmi, "$1"); //1018

			// deal with table ends
			text = text.replace(/{@@tnl@@}{@@pnl@@}(({@@enl@@})*)/gmi, function(match, $1) {
				//$1 = number of new lines separating header from next paragraph
				var newlines = '',
					length = 0;

				if ( $1 ) length = ($1.length/9)  + 1;
				for (var i= 0; i <= length; i++ ) {
					newlines = newlines + '{@@nl@@}';
				} 
				
				return newlines;
			});//0918

			// deal with headers
			text = text.replace(/{@@hnl@@}(({@@nl@@})*){@@[pbth]nl@@}/gmi, function(match, $1) {
				//$1 = number of new lines separating header from next paragraph
				var newlines = '',
					length = 0;

				if ( $1 ) length = ($1.length/8);
				for (var i= 0; i <= length; i++ ) {
					newlines = newlines + '{@@nl@@}';
				} 
				
				return newlines;
			});//0918
//			text = text.replace(/{@@hnl@@}(({@@nl@@})*){@@[bht]nl@@}/gmi, '{@@nl@@}$1');//0918
			
//0916			text = text.replace(/({@@[bht]nl@@})({@@pnl@@})/gmi, "$2"); //0907a
//0115			text = text.replace(/({@@[bht]nl@@})*({@@pnl@@})/gmi, "$2"); //0916
//			text = text.replace(/({@@[bht]nl@@})*({@@pnl@@})/gmi, "{@@nl@@}"); //1018
			// replace remaining br_emptyline_first with 2 new lines
			text = text.replace(/\n?{@@elf@@}/gmi, "{@@2nl@@}");
			// replace br_emptyline with a single new line
			text = text.replace(/\n?{@@enl@@}/gmi, "{@@nl@@}");
			// respect the &nbsp
			text = text.replace(/{@@bnl@@}(&nbsp;)/gmi, "$1");
			// one or more forced new lines for blocks at the start of the page
			// should be removed
			text = text.replace(/^({@@[pbht]nl@@})*/gmi, "");
			// where two or more blocks are adjacent we only need one new line
//0916			text = text.replace(/({@@[pbht]nl@@}\s*)+{@@[pbht]nl@@}/gmi, "{@@nl@@}");
//0120			text = text.replace(/({@@[bht]nl@@}\s*)+{@@[bht]nl@@}/gmi, "{@@nl@@}"); //0916
			// where one or two new lines are followed or preceded by
			// a header/block/table new line then remove it
			text = text.replace(/{@@2nl@@}{@@[pbht]nl@@}/gmi, "{@@2nl@@}");
			text = text.replace(/{@@[pbht]nl@@}{@@2nl@@}/gmi, "{@@2nl@@}");
//0919			text = text.replace(/{@@hnl@@}{@@nl@@}/gmi, "{@@nl@@}");
//0914			text = text.replace(/{@@nl@@}{@@[pbht]nl@@}/gmi, "{@@nl@@}");
			text = text.replace(/{@@nl@@}{@@[bht]nl@@}/gmi, "{@@nl@@}"); //0907
			// rationalise forced new lines for blocks at start and end of table cells
			text = text.replace(/(({@@tnl@@})?\|{1,2}\s*){@@[bh]nl@@}/gmi, "$1");
			text = text.replace(/(({@@tnl@@})?\|{1,2}\s*{@@tnl@@}\s*){@@[bh]nl@@}/gmi, "$1");//0125
			text = text.replace(/{@@[bh]nl@@}(({@@tnl@@})?\|{1,2}\s*)/gmi, "$1");
			// clean up newline before tables in definitions
			text = text.replace(/{@@pnl@@}:{/gmi, '{@@bnl@@}:{');
			// otherwise replace forced 'p' placeholder with single new line
			text = text.replace(/{@@pnl@@}/gmi, "{@@2nl@@}");
			// otherwise replace no paragraph placeholders with nothing
			text = text.replace(/{@@npl@@}/gmi, "");
			// replace two adjacent table new lines by a single one
			text = text.replace(/{@@tnl@@}{@@tnl@@}/gmi, "{@@nl@@}"); //0126
			// otherwise replace forced new line placeholder with single new line
			text = text.replace(/{@@[bht]nl@@}/gmi, "{@@nl@@}");
			// replace br_singlelinebreak with single new line
			text = text.replace(/{@@snl@@}/gmi, "{@@nl@@}");
			// replace the remaining placeholders with wiki code
			text = text.replace(/{@@br@@}/gmi, "<br />");
			text = text.replace(/{@@2nl@@}/gmi, "\n\n");
			text = text.replace(/{@@nl@@}/gmi, "\n");
			// tidy up end of lists(this is an assumption)
			// note: [^\S\r\n] matches whitespace without new lines
			text = text.replace(/(<\/li>)([^\S\r\n]*<\/[uo]l>)/gi, "$1\n$2");
			text = text.replace(/(<\/[uo]l>)([^\S\r\n]*<\/[uo]l>)/gmi, "$1\n$2");
			// tidy up tables row ends(this is an assumption)
			text = text.replace(/(<\/t[hd]>)([^\S\r\n]*<\/tr>)/gmi, "$1\n$2");
			text = text.replace(/(<\/tr>)([^\S\r\n]*<\/table>)/gmi, "$1\n$2");
			//remove any empty <p> blocks, these are spurious anyway
			text = text.replace(/<p><\/p>/gmi, "");
			return text;
		}

		// save some work
		if ( text === '' ) return text;

		// wrap the text in an object to send it to event listeners
		textObject = {text: text};
		$(document).trigger('TinyMCEBeforeHtmlToWiki', [textObject]);
		text = textObject.text;

		// process tags in html using placeholders where needed
		text = convertHtmlElements2Wiki(text);

		//recover special tags to wiki code from placeholders
		text = recoverTags2Wiki(text);

		// recover all the new lines to the text
		text = newLines2wiki (text);

		// finally substitute | with {{!}} if required
		if ( _pipeText == '{{!}}' ) {
			text = text.replace(/\|/gmi, "{{!}}");
		}
		
		//recover protected pipes in templates
		text =text.replace(/{@@pc@@}/gmi, '|');

		// clean up empty space at end of text
		text = text.trimRight();

		// because _ is called recusrsively we get a problem that
		// html entities of form &xxx; get over converted so we used a
		// placeholder to prevent this.  The next line reverse this
		text = text.replace(/{@@_@@}/gmi,"&");

		// wrap the text in an object to send it to event listeners
		textObject = {text: text};
		$(document).trigger('TinyMCEAfterHtmlToWiki', [textObject]);
		text = textObject.text;

		return text;
	}

	/*
	 * Inserts content of the clipboard when it is copied from outside
	 * the TinyMCE editor.
	 *
	 * @param {dom} dom
	 * @returns {dom}
	 */
	function _externalPaste( $dom ) {
		// if pasting a copy from the TinyMCE mediwaiki editor
		// upload any images and replace links with wiki links.
		// Also do any other html processing

		// remove any meta tags in pasted content
		$dom.find( "meta" ).replaceWith( function() {
			return '';
		});

		// convert links to wikilinks
		$dom.find( "a" ).replaceWith( function() {
			var elm = $( this ),
				protocol = elm[0].protocol,
				dstName = elm[0].href,
				title = elm[0].text,
				aLink,
				parserResult,
				parsedHtml,
				linkClasses,
				linkDataType,
				id;

			if (elm[0].firstElementChild && elm[0].firstElementChild.tagName == "IMG") {
				// process links to images
				linkClasses = 'mwt-nonEditableImage mwt-wikiMagic mwt-placeHolder mwt-image mwt-hidePlaceholder';
				linkDataType = 'image';
				aLink = _getWikiImageLink(elm[0].firstElementChild, dstName);
			} else if (protocol) {
				// process external links
				linkClasses = 'mwt-nonEditable mwt-wikiMagic mwt-externallink';
				linkDataType = 'externallink';
				
				if (title) {
					dstName = dstName + ' ' + title;
				}
				aLink = '[' + dstName + ']'
			} else {
				// process internal links
				// should never get here with external paste but
				// we'll leave it here in case we develop logic to recognise
				// external links which are really internal!!
				linkClasses = 'mwt-nonEditable mwt-wikiMagic mwt-internallink';
				linkDataType = 'internallink';
				
				if (title) {
					dstName = dstName + '|' + title;
				}
				aLink = '[[' + dstName + ']]'
			}
					
			id = "{@@@EXTERNALLINK:" + createUniqueNumber() + "@@@}";
			_tags4Wiki[id] = aLink;

			parserResult = _getParsedHtmlFromWiki( aLink );
			parsedHtml = parserResult['parsedHtml'];		

			return '<div class="' + linkClasses + '" title="' + aLink + '" id="' + id + '" data-mwt-type="' + linkDataType + '" data-mwt-wikitext="' + aLink + '" draggable="true" contenteditable="false">' + parsedHtml + '</div>';
		});
		
		// upload any images that aren't part of a link
		$dom.find( "img" ).replaceWith( function() {
			var elm = $( this ),
				aLink,
				parserResult,
				parsedHtml,
				linkClasses,
				linkDataType,
				id;

			if (elm[0].parentNode.tagName != "A") {
				linkClasses = 'mwt-nonEditableImage mwt-wikiMagic mwt-placeHolder mwt-image mwt-hidePlaceholder';
				linkDataType = 'image';
				aLink = _getWikiImageLink( elm[0] );
				
				if ( aLink ) {
					// if a link was created
					id = "{@@@EXTERNALLINK:" + createUniqueNumber() + "@@@}";
					_tags4Wiki[id] = aLink;
					
					parserResult = _getParsedHtmlFromWiki( aLink );
					parsedHtml = parserResult['parsedHtml'];
	
					return '<div class="' + linkClasses + '" title="' + aLink + '" id="' + id + '" data-mwt-type="' + linkDataType + '" data-mwt-wikitext="' + aLink + '" draggable="true" contenteditable="false">' + parsedHtml + '</div>';
				} else {
					// else return nothing
					return '';
				}
			} else {
				return elm[0].outerHTML;
			}
		});

		// process headers from rendered wiki pages
		$dom.find( ":header" ).replaceWith( function() {
			var elm = $( this ),
				contentText,
				childElm;
				
			childElm = elm.children( ".mw-headline" )[0]
			if ( childElm ) {
				childElm.replaceWith( childElm.innerHTML );
				elm.addClass( "mw-headline" );
			}
			
			return elm[0].outerHTML;
		});

		return $dom;
	}

	/**
	 * Event handler for "onChange"
	 * @param {tinymce.ContentEvent} e
	 */
	function _onChange(e) {
	}

	/**
	 * Event handler for "beforeSetContent"
	 * This is used to process the wiki code into html.
	 * @param {tinymce.ContentEvent} e
	 */
	function _onBeforeSetContent(e) {
		// if raw format is requested, this is usually for internal issues like
		// undo/redo. So no additional processing should occur. Default is 'html'

		debug( editor, "anteOnBeforeSetContent", _mwtDebugFlags.anteOnBeforeSetContent, e.content );

		// decode html entities in input if flag is set
		if ( _decodeHtmlEntitiesOnInput == 'true' ) {
			e.content = htmlDecode( e.content );
		}

		// if the format is raw then don't process further
		if (e.format == 'raw' ) {
			return;
		}

		// if this is the initial load of the editor
		// tell it to convert wiki text to html
		if (e.initial == true) {
			e.convert2html = true;
		}
		
		// if this results from a paste operation then check if any parent of
		// the selected node is non-editable and select the top most non-editable
		// parent to be replaced by the pasted content
		if (e.paste == true) {
			editor.focus();
			var nonEditableParents = editor.dom.getParents(editor.selection.getNode(),function ( anode ) {
	
				if (anode.contentEditable === 'false') {
					return anode
				}
			});
			if (nonEditableParents.length >= 1) {
				editor.selection.select( nonEditableParents[ nonEditableParents.length - 1 ] );
			}
		}

		// for some reason _showPlaceholders won't be picked up so set it here again!
		_showPlaceholders = editor.getParam("showPlaceholders");
		_placeholderClass = _showPlaceholders ? "mwt-showPlaceholder" : "mwt-hidePlaceholder";

		// set format to raw so that the Tiny parser won't rationalise the html
		e.format = 'raw';

		// if the content left over from browser back event
		if ( e.content.match(/^<div class="tinywrapper">/)
			|| e.content.match(/\sclass=('|")[^\1]*?mwt-[^\1]/) ) {
			e.convert2html = false;
		}

		// if the content is wikitext then convert to html
		if ( e.convert2html ) {
			e.content = _convertWiki2Html(e.content, e.mode);
		}

		// sanitize the content to be sure xss vulnerabilities are removed
		e.content = _sanitize( e.content, false );

		debug( editor, "postOnBeforeSetContent", _mwtDebugFlags.postOnBeforeSetContent, e.content );

		return;
	}

	/**
	 * Event handler for "onSetContent".
	 * This is currently not used.
	 * @param {tinymce.SetContentEvent} e
	 */
	function _onSetContent(e) {
		return;
	}

	/**
	 * Event handler for "onBeforeExecCommand".
	 * This is currently not used.
	 * @param {tinymce.SetContentEvent} e
	 */
	function _onBeforeExecCommand(e) {
		var classList = [],
			validForPlainText,
			selectedNode = editor.selection.getNode(),
			selectedNodeParent = editor.selection.getNode().parentNode,
			args,
			wikitext;

		// if this is a SelectAll operation then bypass processing altogether
		if ( e.command == "SelectAll" ) {
			//return;
			editor.selection.select( editor.getBody(), false );
		}

		if ( selectedNodeParent.className ){
			classList = selectedNodeParent.className.split(' ')
		}
		if ( selectedNode.className ){
			classList = classList.concat( selectedNode.className.split(' ') );
		}
		
		// if this is a plain text class and the command is disallowed for plain text
		// elements then abort the operation
		if ( _mwtPlainTextClasses.some( r => classList.includes( r ))) {
			if ( !_mwtPlainTextTagsCommands.includes( e.command )) {
				alert( translate("tinymce-pre-alert-only-plain-text") );
				e.preventDefault();
				e.stopImmediatePropagation();
				e.stopPropagation();
			} else if ( e.command == "mceToggleFormat" ) {
				var savedValue = getSelection( editor );
				editor.formatter.toggle( e.value );
				wikitext = getSelection( editor );
				if ( wikitext == savedValue ) {
					wikitext = editor.selection.getNode().outerHTML;
				}
				wikitext = _convertHtml2Wiki( wikitext );
				wikitext = htmlEncode( wikitext );
				args = {format: 'wiki', mode: 'inline', convert2html: false}
				editor.insertContent( wikitext, args);
				e.preventDefault();
				e.stopImmediatePropagation();
				e.stopPropagation();

			} else if ( e.command == "InsertUnorderedList" ) {
				wikitext = '* ' + getSelection( editor );
				args = {format: 'wiki', mode: 'inline', convert2html: false}
				editor.insertContent( wikitext, args);
				e.preventDefault();
				e.stopImmediatePropagation();
				e.stopPropagation();
			} else if ( e.command == "InsertOrderedList" ) {
				wikitext = '# ' + getSelection( editor );
				args = {format: 'wiki', mode: 'inline', convert2html: false}
				editor.insertContent( wikitext, args);
				e.preventDefault();
				e.stopImmediatePropagation();
				e.stopPropagation();
			} else if ( e.command == "mwt-insertReference" ) {
				wikitext = '<ref>' + getSelection( editor ) + '</ref>';
				args = {format: 'wiki', mode: 'inline', convert2html: false}
				editor.insertContent( wikitext, args);
				e.preventDefault();
				e.stopImmediatePropagation();
				e.stopPropagation();
			} else if ( e.command == "mceInsertContent" ) {
				if (e.value.convert2html) {
//						e.value.content = _convertWiki2Html(e.value.content, e.value.mode);
//						e.value.convert2html = false;
//						e.value["format"] = 'raw';
				} else if (e.value.convert2wiki) {
					e.value.content = '\n' + _convertHtml2Wiki( e.value.content );
					e.value.convert2wiki = false;
					e.value["format"] = 'raw';
				} else {
					if ( e.value.content ) {
						e.value.content = e.value.content.replace(/</gm, '&lt;' );
					} else if ( e.value ) {
						e.value = e.value.replace(/</gm, '&amp;lt;' );
					}
				}
			}
		} else if ( e.command == "mceInsertContent" ) {
			if ( e.value.newRef != undefined ) {
				// if this is a new reference then ensure placeholder is displayed
				if ( e.value.newRef == true ) {
					_placeholderClass = "mwt-showPlaceholder";
				}
			}
			if (e.value.convert2html) {
				e.value.content = _convertWiki2Html(e.value.content, e.value.mode);
				e.value.convert2html = false;
				e.value["format"] = 'raw';
			}			
		}

		return;
	}

	/**
	 * Event handler for "beforeGetContent".
	 * This is used to ensure TintMCE process the content as 'raw' html.
	 * @param {tinymce.ContentEvent} e
	 */
	function _onBeforeGetContent(e) {
		// generally we want to get the content of the editor
		// unaltered by any html rationalisation!!!
			e.format = 'raw';
		return;
	}

	/**
	 * Event handler for "getContent".
	 * This is used to process html into wiki code.
	 * @param {tinymce.ContentEvent} e
	 */
	function _onGetContent(e) {
		var text = e.content,
			isInTemplate;
		
		debug( editor, "anteOnGetContent", _mwtDebugFlags.anteOnGetContent, text );

		// sanitize the content to be sure xss vulnerabilities are removed
		text = _sanitize( text, false );

		if (e.save == true) {
			e.convert2wiki = true;
		}
		
		if (e.convert2wiki) {
			text = _convertHtml2Wiki( text );
			e.convert2wiki = false;
		} else {
			// if we are just retrieving the html, for example for CodeMirror,
			// we may have to tidy up some of the 'rationalisation' that
			// TinyMCE makes to the html, mainly as a result of forcing root blocks
//			text = text.replace(/<br class="mwt-emptylineFirst"><\/p>/gm,"</p>");
			text = text.replace(/{@@nl@@}/gmi, '\n');

		}

		debug( editor, "postOnGetContent",_mwtDebugFlags.postOnGetContent, text );

		e.content = text;

		return;
	}

	/**
	 * Event handler for "loadContent".
	 * This is currently not used.
	 * @param {tinymce.LoadContentEvent} e
	 */
	function _onLoadContent(e) {
//		tinymce.activeEditor.on('ScriptsLoaded', function(e) {
//			var _toolbarResizeFactor = tinymce.activeEditor.getParam("toolbarResize");
	  
			/**
			 * dynamicallyAccessCSS 
			 *
			 * @link    https://github.com/Frazer/dynamicallyAccessCSS.js
			 * @license MIT
			 *          
			 * @author  Frazer Kirkman
			 * @published 2016
			 */
			  
/*			var returnStyleSheetRules = (function (){  
				if(!document.styleSheets[0]){
					// Create the <style> tag
					var style = document.createElement("style");
					// WebKit hack :(
					style.appendChild(document.createTextNode(""));
					// Add the <style> element to the page
					document.head.appendChild(style);
				  
				}
				if(document.styleSheets[0].cssRules){
					return function (item) {return  item.cssRules;}
				} else if (document.styleSheets[0].rules) {
					return function (item) {return  item.rules;}
				}
			})();
			  
			function getCSSRule(search, returnArray) {  
				let styleSheets = [].map.call(document.styleSheets, function(item) {
					return [].slice.call(returnStyleSheetRules(item));
				});
	  
				let rule = null;
				let rules = [];
				styleSheets.forEach(function(thisSheet){
					let findTheRule = thisSheet.filter(function(rule) {
						if(rule.selectorText){
							if(rule.selectorText == search){
								return rule.selectorText.indexOf(search)>=0;	
							}else return false;
						}
					});
				  
					if(findTheRule.length){
						  rules = rules.concat(findTheRule);
						  rule = findTheRule[findTheRule.length-1];    //findTheRule will contain all rules that reference the selector. findTheRule[findTheRule.length-1] contains the last rule.
					}
				});

				if (rule){
					if(returnArray){
						return rules;
					}else{
						return rule;
					}
				}else{
					let sheet = document.styleSheets[0];   //if the rule we are looking for doesn't exist, we create it
					var pos = sheet.cssRules.length;
					rule = search + "{  }";
					sheet.insertRule( rule ,pos );
					rule = sheet.cssRules[pos];
				}
	
				if(returnArray){
					returnStyleSheetRules(document.styleSheets[0]);
					return rules = rules.concat(rule);
				}else{
					returnStyleSheetRules(document.styleSheets[0])[pos];
					return rule;
				}
			}

			var myRules  = getCSSRule('.tox-tbtn', true);
			myRules.forEach(function(thisRule){
				thisRule.style.transform = "scale(" + _toolbarResizeFactor + ")";
				thisRule.style.setProperty ("height", 34 * _toolbarResizeFactor + "px", "important");
				thisRule.style.setProperty ("width", "auto", "important");
			});
//		});*/

		return;
	}

	/**
	 * Event handler for "drop"
	 * Add function for processing when drag/dropping items.
	 * @param {tinymce.DropEvent} e
	 */
	function _onDrop(e) {
		return;
	}

	/**
	 * Event handler for "onPastePreProcess"
	 * Add function for processing when drag/dropping items.
	 * @param {tinymce.DropEvent} e
	 */
	function _onPastePreProcess(e) {
		// if this is html then covert to wiki and back so it displays correctly
		var text = e.content,
			textObject,
			selectedNode = editor.selection.getNode(),
			selectedNodeParent = selectedNode.parentNode,
			classList = [];

		if ( selectedNodeParent.className ){
			classList = selectedNodeParent.className.split(' ')
		}
		if ( selectedNode.className ){
			classList = classList.concat( selectedNode.className.split(' ') );
		}

		// if this is a plain text element, encode what we are pasting
		if ( _mwtPlainTextClasses.some( r => classList.includes( r ))) {
			if ( e.internal ) {
				text = _convertHtml2Wiki( text );
				text = text.replace(/\n/gmi, '<br class="mwt-emptyLine">');
			} else {
				text = text.replace(/</gm, '&lt;');
			}
		}

		// wrap the text in an object and send it to event listeners
		textObject = {text: text};
		$(document).trigger('TinyMCEBeforePastePreProcess', [textObject]);
		text = textObject.text;
		
		// wrap the text in an object and send it to event listeners
		textObject = {text: text};
		$(document).trigger('TinyMCEAfterPastePreProcess', [textObject]);
		text = textObject.text;

		e.content = text;
	}

	/**
	 * Event handler for "onPastePreProcess"
	 * Add function for processing when drag/dropping items.
	 * @param {tinymce.DropEvent} e
	 */
	function _onPastePostProcess(e) {
		// check if this is the content of a drag/drop event
		// if it is then no need to convert wiki to html
		var text,
			dom;


		dom = $(e.node);
		text = dom[0].innerHTML;
		
		// get rid of any empty spans - these result from drag drop
		// operations where computed styles have been filtered out
		dom.find( "span" ).replaceWith( function() {
			if (this.attributes.length == 0 ||
				this.classList.length == 0 ||
				this.style == '') {
				return this.innerHTML;
			} else {
				return this.outerHTML;
			}
		})
		
		debug( editor, "anteOnPastePostProcess", _mwtDebugFlags.anteOnPastePreProcess, text );

		if ( e.internal ) {
			_internalPaste( dom );
		} else {
			_externalPaste( dom );
		}

		text = dom[0].innerHTML;
		debug( editor, "postOnPastePostProcess", _mwtDebugFlags.postOnPastePreProcess, text );
	}

	/**
	 * Event handler for "dblclick"
	 * Add function for processing when double clicking items.
	 * @param {tinymce.DblclickEvent} e
	 */
	function _onDblClick(evt) {
		var editor = tinymce.activeEditor,
			selectedNode=evt.target,
			classList,
			targetFound = false;

		function execCommand( aNode, aCommand ) {
			editor.selection.select( aNode );
			editor.execCommand( aCommand );
		}
		
		function fix_selection(range) {
			var selection = editor.selection.getSel(editor.selection.setRng( range )),
				selected = range.toString(),
				start = range.startOffset,
				end = range.endOffset;

			if ( end - start > 1 ) {
				// has to be at least 2 long in order to trim
				if ( start != end ) {
					if (/\s+$/.test(selected)) { // Removes leading spaces
						if (start > end) {
							range.setEnd(selection.focusNode, --start);
						} else {
							range.setEnd(selection.anchorNode, --end);
						}
					}
					if (/^\s+/.test(selected)) { // Removes trailing spaces
						if (start > end) {
							range.setStart(selection.anchorNode, ++end);
						} else {
							range.setStart(selection.focusNode, ++start);
						}
					}
				}
			}
			return range
		}

		function executeDbleClick( aNode ) {
			var classList = [];

			// exit if nothing selected
			if ( aNode == null ) return ;
			
			// if this is an image select its holder class
			if ( aNode.tagName == 'IMG' ) aNode = editor.selection.select( editor.dom.getParent( aNode, ".mwt-image" ));

			if ( aNode.className ){
				classList = classList.concat( aNode.className.split(' ') );
			}

			if ( classList.length == 0 ) return;
			
			if ( classList.indexOf( "mwt-image" ) > -1 ) {
				execCommand( aNode, "wikiupload" );
			} else if ( classList.indexOf( "mwt-internallink" ) > -1 ) {
				execCommand( aNode, "wikilink" );
			} else if ( classList.indexOf( "mwt-externallink" ) > -1 ) {
				execCommand( aNode, "wikilink" );
			} else if ( classList.indexOf( "mwt-wikiMagic" ) > -1 ) {
				execCommand( aNode, "wikitextEditor" );
			} else if ( classList.indexOf( "mwt-referenceHolder" ) > -1 ) {
				execCommand( aNode, "wikiToggleRefText" );
			} else if ( classList.indexOf( "mwt-commentHolder" ) > -1 ) {
				execCommand( aNode, "wikiToggleRefText" );
			} else {
				executeDbleClick( editor.dom.getParent( aNode, '', editor.getBody()) )
			}
			
			return;
		}

		// deselect any trailing spaces from the selection
		if ( !editor.selection.isCollapsed() ) {
			editor.selection.setRng( fix_selection( editor.selection.getRng() ));
		}

		executeDbleClick( evt.target );

		return;
	}

	/**
	 * Event handler for "click"
	 * Add function for processing when clicking items.
	 * @param {tinymce.DblclickEvent} e
	 */
	function _onClick(evt) {
	}


	/**
	 * Event handler for "onKeyDown"
	 * Add function for processing when using down or up arrow in
	 * the bottom or top rows, to add a new paragraph.
	 *
	 * @param {tinymce.onKeyDownEvent} e
	 */	
	function _onKeyDown(evt) {
		var editor = tinyMCE.activeEditor,
			_cursorOnDown,
			_cursorOnUp,
			_cursorOnDownIndex,
			_cursorOnUpIndex,
			_cursorOnDownPreviousNode,
			_cursorOnUpPreviousNode,
			_cursorOnDownNextNode,
			_cursorOnUpNextNode;
		
		//find the offset of the cursor within the displayed text
		function getCursorOffset() {
			var range,
				text,
				bm,
				index,
				parents = {},
				parentsPreviousSibling = {},
				rootNode = editor.getBody(),
				currentNode = null,
				previousNode = null,
				nextNode = null,
				firstNode = false;

			function getPreviousNode( aNode ) {
				var previousNode = aNode.previousSibling,
					parents = editor.dom.getParents( aNode );
	
				function validPreviousNode( aaNode ) {
					while ( aaNode  && (aaNode.nodeType != 3 )) {
						if ( aaNode.attributes[ "data-mce-bogus" ] ) {
							aaNode = aaNode.previousSibling;
						} else {
							break;
						}
					}
					return aaNode;
				}
				
				if ( !validPreviousNode( previousNode )) {
					tinymce.each( parents , function( aParent ) {
						if ( aParent == rootNode ) return false;
						if ( validPreviousNode( aParent.previousSibling ) ) {
							previousNode = aParent.previousSibling;
							return false;
						}
					});
				} 
				return previousNode;
			}
	
			function getNextNode( aNode ) {
				var nextNode = aNode.nextSibling,
					parents = editor.dom.getParents( aNode );
	
				function validNextNode ( aaNode ) {
					while ( aaNode && (aaNode.nodeType != 3 )) {
						if ( aaNode.attributes[ "data-mce-bogus" ] ) {
							aaNode = aaNode.nextSibling;
						} else {
							break;
						}
					}
					return aaNode;
				}
				
				if ( !validNextNode( nextNode )) {
					tinymce.each( parents , function( aParent ) {
						if ( aParent == rootNode ) return false;
						if ( validNextNode( aParent.nextSibling ) ) {
							nextNode = aParent.nextSibling;
							return false;
						}
					});
				}
				return nextNode;
			}
	
			currentNode = editor.selection.getNode()
			previousNode = getPreviousNode( currentNode );
			nextNode = getNextNode( currentNode );
			bm = editor.selection.getBookmark();
			range = editor.selection.getRng();
			range.setStart(editor.getBody().firstChild, 0);
			text = range.toString();
			editor.selection.moveToBookmark(bm);
	
			return {
				cursor: text.length, 
				text: text,
				index: index,
				previousNode: previousNode,
				nextNode: nextNode
			}
		} 
	
		if ( evt.keyCode == 38 ) {
			// up-arrow or down arrow at start or end of editor
			// content results in an empty paragraph being added
			var cursorLocation = getCursorOffset();

			//if not at start of editor content carry on 
			if ( cursorLocation.cursor != 0 ) return;

			//if previous node is not null, select and carry on 
			_cursorOnDown = cursorLocation.cursor;
			_cursorOnDownPreviousNode = cursorLocation.previousNode;
			if ( _cursorOnDownPreviousNode == null )  {
				// we are already at start of text
				var el = editor.dom.create( 'p', { 'class' : 'mwt-notParagraph' }, '<br class="mwt-emptyline">' );
				editor.getBody().insertBefore(el, editor.getBody().firstChild);
				editor.selection.setCursorLocation();
				evt.preventDefault();
				evt.stopImmediatePropagation();
				evt.stopPropagation();
			} else {
				editor.selection.select( _cursorOnDownPreviousNode );
				evt.preventDefault();
				evt.stopImmediatePropagation();
				evt.stopPropagation();
			}
		} else if ( evt.keyCode == 40 ) {
			// up-arrow or down arrow at start or end of editor
			// content results in an empty paragraph being added
			var cursorLocation = getCursorOffset();

			//if next node is not null, carry on 
			if ( cursorLocation.nextNode != null ) return;
			
			_cursorOnDown = cursorLocation.cursor;
			_cursorOnDownNextNode = cursorLocation.nextNode;
			var range = editor.selection.getRng();
			editor.selection.select(editor.getBody(), true);
			var ftxt = editor.selection.getRng().toString().trimRight().length;
			editor.selection.setRng( range );
			if ( _cursorOnDown >= ftxt ) {
				if ( _cursorOnDownNextNode == null ) { 
					// the cursor din't move forward
					// we're already at the end of the text
					var el = editor.dom.create( 'p', { 'class' : 'mwt-paragraph' }, '<br class="mwt-emptyline">' );
					$(el).insertAfter(editor.getBody().lastChild);;
					editor.selection.select( el );
            				editor.selection.scrollIntoView();
					editor.selection.collapse();
					evt.preventDefault();
					evt.stopImmediatePropagation();
					evt.stopPropagation();
				} else {
					editor.selection.select( _cursorOnDownNextNode );
					evt.preventDefault();
					evt.stopImmediatePropagation();
					evt.stopPropagation();
				}
			}
		} else if ( evt.keyCode == 13 ) {
			var selectedNode = editor.selection.getNode(),
				selectedNodeParent = selectedNode.parentNode,
				classList = [],
				args;

			if ( selectedNodeParent.className ){
				classList = selectedNodeParent.className.split(' ');
			}
			if ( selectedNode.className ){
				classList = classList.concat( selectedNode.className.split(' ') );
			}

			// if this is a plain text element, or is the content of a reference
			// conver <br> to \n
			if ( _mwtPlainTextClasses.some( r => classList.includes( r ))
				|| ( classList.includes( "mwt-reference" ))) {
				var id = 'BR' + createUniqueNumber();

				if ( classList.includes( 'mwt-nowiki' ) ) {
					args = {format: 'html', mode: 'inline', convert2html: false}
					editor.insertContent( '&#010;', args );
				} else {
					args = {format: 'wiki', mode: 'inline', convert2html: true}
					editor.insertContent( '<br id="' + id + '" class="mwt-emptyline">', args );
					editor.selection.select( editor.dom.select('#' + id )[0]);
					editor.selection.collapse( false );
					editor.nodeChanged();		
				}
				evt.preventDefault();
				evt.stopImmediatePropagation();
				evt.stopPropagation();
			}
		}
	};

	/**
	 * Event handler for "onKeyUp"
	 * Add function for processing when using down or up arrow in
	 * the bottom or top rows, to add a new paragraph.
	 *
	 * @param {tinymce.onKeyUpEvent} e
	 */	
	function _onKeyUp(evt) {
		if ( evt.keyCode == 38 ) {
		} else if ( evt.keyCode == 40 ) {
		}
	};

function wikiparser( editor ) {
	/**
	 * Initialise editor function
	 * Defines event handlers.
	 *
	 * @param {array} ed = the instance of the editor
	 * @param {string} url = the url of this tinyMCE plugin
	 * @returns {String}
	 */
	this.init = function(editor, url) {
		//
		// see if we are in a template class  and set the pipe text accordingly
		//
		var isInTemplate = false;
		
		debug( editor, "settings", _mwtDebugFlags.anteOnBeforeSetContent, editor.settings );

		_mwtTemplateClasses.forEach( function( aClass ) {
			if ($(editor.targetElm).hasClass( aClass ) ) {
				isInTemplate = true;
			}
		});

		// Elements of id pf_free_text are in page forms templates
		// but not assigned to the template class so we put this
		// here as a failsafe - must check with Yaron if a change
		// is also needed in PF?
		if ( editor.targetElm.id == 'pf_free_text' ) {
			isInTemplate = true;
		}

		_pipeText = isInTemplate ? '{{!}}' : '|';
		
		// stash common placeholders
		_tags4Wiki[ '{@@@AMPAMP:0@@@}' ] = '&amp;amp;';
		_tags4Html[ '{@@@AMPAMP:0@@@}' ] = _ampamp;
		_tags4Wiki[ '{@@@LTE:0@@@}' ] = '<';
		_tags4Html[ '{@@@LTE:0@@@}' ] = _lte;
		_tags4Wiki[ '{@@@GTE:0@@@}' ] = '>';
		_tags4Html[ '{@@@GTE:0@@@}' ] = _gte;
		_tags4Wiki[ '{@@@SLB:0@@@}' ] = '\n';
		_tags4Html[ '{@@@SLB:0@@@}' ] = _slb;
		_tags4Wiki[ '{@@@ENL:0@@@}' ] = '\n';
		_tags4Html[ '{@@@ENL:0@@@}' ] = _enl;
		_tags4Wiki[ '{@@@ELF:0@@@}' ] = '\n\n';
		_tags4Html[ '{@@@ELF:0@@@}' ] = _elf;

		//
		// set up functions that respond to events
		//
		editor.on('loadContent', _onLoadContent);
		editor.on('change', _onChange);
		editor.on('beforeSetContent', _onBeforeSetContent);
		editor.on('setContent', _onSetContent);
		editor.on('beforeGetContent', _onBeforeGetContent);
		editor.on('getContent', _onGetContent);
		editor.on('beforeExecCommand', _onBeforeExecCommand);
		editor.on('drop', _onDrop);
		editor.on('pastePreProcess', _onPastePreProcess);
		editor.on('pastePostProcess', _onPastePostProcess);
		editor.on('dblclick', _onDblClick);
		editor.on('keydown', _onKeyDown);
		editor.on('keyup', _onKeyUp);
			
		//
		// set up element to contain toolbar if not attached to edit window
		//
		var selector = '#top',
			mwexttb = $( '#mwext-tinytoolbar' );
		// if there is no placeholder for inline toolbar already, then add one
		if ( mwexttb.length == 0 ) {
			$( selector ).before( '<div id="mwext-tinytoolbar" class="mwt-toolbar"></div>' );
			mwexttb = $( '#mwext-tinytoolbar' );
			// if you wish to have empty space permanently for the tool bar then
			// un-comment the following line
//			mwexttb.append( '' );
		}
				
		//
		// add processing for browser context menu
		//
		editor.ui.registry.addButton('browsercontextmenu', {
			icon: 'info',
			tooltip: translate( 'tinymce-browsercontextmenu' ),
			onAction:  function(e) {
				editor.focus();
				editor.windowManager.confirm(translate( 'tinymce-browsercontextmenu' ), function(state) {
					if (state) {
						editor.off('contextmenu');
					}
				});
			}
		});
		editor.ui.registry.addMenuItem('browsercontextmenu', {
			icon: 'info',
			text: translate('tinymce-browsercontextmenu-title'),
			tooltip: translate( 'tinymce-browsercontextmenu' ),
			context: 'insert',
			onAction: function(e) {
				editor.focus();
				editor.windowManager.confirm(translate( 'tinymce-browsercontextmenu' ), function(state) {
					if (state) {
						editor.off('contextmenu');
					}
				});
			}
		});
		
		//
		// add processing for inserting empty <p> block before or after curent block
		//
		editor.shortcuts.add('meta+' + 13, 'empty paragraph after this block', function (a) {
			var el = editor.dom.create('p', {'class' : 'mwt-paragraph'}, '<br>');
			editor.dom.insertAfter( el, editor.selection.getNode() );
			editor.selection.setCursorLocation( el );
		});
		editor.shortcuts.add('access+' + 13, 'empty paragraph before this block', function (a) {
			var el = editor.dom.create('p', {'class' : 'mwt-paragraph'}, '<br>');
			$(el).insertBefore( editor.selection.getNode() );
			editor.selection.setCursorLocation( el );
		});
		//
		// setup MW TinyMCE macros - these are defined in localSettings.php
		//
		var templates = editor.getParam("tinyMCETemplates"),
			templateItems = [];
		if ( Array.isArray( templates )) {
			templates.forEach( function( template ) {
				templateItems.push({
					title: template['title'],
					description: template['description'],
					content: htmlDecode ( template['content'] ),
				});
			});
		}
		editor.settings['templates'] = templateItems;

	//
	// setup minimising menubar when field not selected in pageforms
	//
/*	var minimizeOnBlur = $(editor.getElement()).hasClass( 'mceMinimizeOnBlur' );
		if ( minimizeOnBlur ) {
			editor.on('focus', function(e) {
//0207			tinyMCE.activeEditor.on('focus', function(e) {
//0207				var mcePane = $("textarea#" + e.target.id).prev();
				var mcePane = $("textarea#" + e.target.id).css( "background-color", "red" );
				mcePane.find(".tox-toolbar__primary").css("height", "");
				mcePane.find(".tox-toolbar__primary .tox-flow-layout").show("medium");

			});
			editor.on('blur', function(e) {
//0207			tinyMCE.activeEditor.on('blur', function(e) {

//0207				var mcePane = $("textarea#" + e.target.id).prev();
				var mcePane = $("textarea#" + e.target.id).css( "background-color", "green" );
				// Keep a little sliver of the toolbar so that users see it.
				mcePane.find(".tox-toolbar__primary").css("height", "10px");
				mcePane.find(".tox-toolbar__primary .tox-flow-layout").hide("medium");
			});
		}*/
	};
	this.getInfo = function() {
		var info = {
			longname: 'TinyMCE WikiCode Parser',
			author: 'Hallo Welt! GmbH, Duncan Crane at Aoxomoxoa Limited & Yaron Koren at Wikiworks',
			authorurl: 'http://www.hallowelt.biz, https://www.aoxomoxoa.co.uk, https://wikiworks.com/',
			infourl: 'http://www.hallowelt.biz, https://www.aoxomoxoa.co.uk, https://wikiworks.com/'
		};
		return info;
	};
};

	pluginManager.add('wikiparser', wikiparser);

}(window));
