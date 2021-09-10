/**
 * plugin.js
 *
 * Released under LGPL License.
 * Copyright (c) 1999-2015 Ephox Corp. All rights reserved
 *
 * Copyright (c) Aoxomoxoa Limited. All rights reserved.
 * Author: Duncan Crane, duncan.crane@aoxomoxoa.co.uk
 * Licensed under the LGPL or a commercial license.
 * For LGPL see License.txt in the project root for license information.
 *
 * Version: 1.1.1 (2021-09-10)
 */
var wikiupload = function (editor) {

    'use strict';

	var	editor = tinymce.activeEditor;

	var allow_external_targets = editor.getParam("link_allow_external_targets");
	
	var utility = editor.getParam("wiki_utility");
	
	var setSelection = utility.setSelection;
	
	var doUpload = utility.doUpload;

	var checkUploadDetail = utility.checkUploadDetail;

	var translate = utility.translate;
	
	var me = this,
		_srccontent,
		_srcvalue,
		_savedOverWriteInput,
		_userThumbsize = 3,
		_thumbsizes = ['120', '150', '180', '200', '250', '300'],
		_imageFileExtensions = ['apng', 'bmp', 'gif', 'ico', 'cur', 'jpg', 'jpeg', 'jfif', 'pjpeg', 'pjp', 'png', 'svg', 'tif', 'tiff', 'webp', 'pdf'],
		_lastChanged;

	var _mwtWikiApi = editor.getParam("wiki_api_path"),
		_mwtPageTitle = editor.getParam("wiki_page_mwtPageTitle"),
		_mwtNamespaces = editor.getParam("wiki_namespaces"),
		_mwtFileNamespace = editor.getParam("wiki_fileNamespace"),
		/**
		 *
		 * Function for checking this user wiki upoload permissions this wiki
		 * @type String
		 */
		_mwtCheckUploadPermissions = function( editor ) {
			// function to check what upload permissions this user has
			// it will provide an alert if certain permissions aren't granted
			// and returns a value saying what permiossions the user has
			var permissions = [];
				
			// start by assuming nothing is allowed
			permissions['userMayUpload'] = false;
			permissions['userMayUploadFromURL'] = false;
			permissions['uploadsAllowed'] =  false;
	  
			if (mw.config.get( 'wgTinyMCEUserMayUpload' )) {
				permissions['userMayUpload'] = true;
				permissions['uploadsAllowed'] =  true;
			}
	  
			if (mw.config.get( 'wgTinyMCEUserMayUploadFromURL' )) {
				permissions['userMayUploadFromURL'] = true;
				permissions['uploadsAllowed'] =  true;
			}
	  
			if (mw.config.get( 'wgReadOnly' )) {
				editor.windowManager.alert(mw.config.get( 'wgReadOnly' ));
				permissions['uploadsAllowed'] = false;
			}
	  
			if (!mw.config.get( 'wgEnableUploads' )) {
				editor.windowManager.alert(translate("tinymce-upload-alert-uploads-not-enabled"));
				permissions['uploadsAllowed'] = false;
			}
	  
			if (mw.config.get( 'wgTinyMCEUserIsBlocked' )) {
				editor.windowManager.alert(translate("tinymce-upload-alert-uploads-not-allowed"));
				permissions['uploadsAllowed'] = false;
			}
			return permissions;
		}

	_userThumbsize = _thumbsizes[ mw.user ? mw.user.options.get('thumbsize') : 3 ];

	var upload = function ( editor ) {
		var dialogData,
			format, 
			pclass, 
			win, 
			data = {}, 
			dom = editor.dom, 
			imgElm, 
			figureElm, 
			srcType = 'File',
			width, 
			height, 
			link, 
			typelist = [],
			imageDimensions = editor.settings.image_dimensions !== false,
			uploadPersmissions = [];

		/**
		 * display upload dialog
		 *
		 * @param {String} text
		 * @returns {String}
		 */
		function displayUploadForm(dialogData, imgElm) {
			var wikiImageObject = [],
				aLink,
				parts,
				part = '',
				unsuffixedValue, 
				dimensions, 
				kvpair, 
				key, 
				value, 
				src,
				parserResult = [],
				imageText,
				imageHTML,
				imageWikiText,
				displayImageWikiText,
				t,
				id,
				el,
				codeAttrs;

			var typeListCtrl = {
					name: 'type',
					type: 'selectbox',
					label: translate("tinymce-upload-type-label"),
					tooltip: translate("tinymce-upload-type-tooltip"),
					autofocus: true,
					items: typelist,
				},
				fileSrcCtrl = {
					name: 'fileSrc',
		  			type: 'urlinput',
					label: translate("tinymce-upload-source-label"),
					tooltip: translate("tinymce-upload-source-tooltip"),
					filetype: 'image',
					disabled: !uploadPersmissions.userMayUpload
				},
				urlSrcCtrl = {
					name: 'urlSrc',
					type: 'input',
					label: translate("tinymce-upload-source-label"),
					tooltip: translate("tinymce-upload-source-tooltip"),
					disabled: !uploadPersmissions.userMayUpload
				},
				wikiSrcCtrl = {
					name: 'wikiSrc',
					type: 'input',
					label: translate("tinymce-upload-source-label"),
					tooltip: translate("tinymce-upload-source-tooltip"),
				},
				displaySrcCtrl = {
					name: 'displaySrc',
					type: 'input',
					label: translate("tinymce-upload-source-label"),
					tooltip: translate("tinymce-upload-source-tooltip"),
					disabled: true
				},
				srcTextDisplay = {
					name: 'srcText',
					type: 'input',
					label: translate("tinymce-upload-source-label"),
					disabled: true,
				},
				destTextCtrl = {
					name: 'dest',
					type: 'input',
					label: translate("tinymce-upload-destination-label"),
					tooltip: translate("tinymce-upload-destination-tooltip"),
				},
				overwriteCtrl = {
					name: 'overwriteCtrl',
					type: 'iframe',
				},
				displayOverwriteFile = {
					name: 'overwriteFile',
					type: 'iframe',
  				},
				titleTextCtrl = {
					name: 'title',
					type: 'input',
					label: translate("tinymce-upload-title-label"),
					tooltip: translate("tinymce-upload-title-tooltip"),
				},
				dummySummary = {
					name: 'dummySummary',
					type: 'textarea',
					label: translate("tinymce-upload-summary-label"),
					disabled: true,
				},
				summaryTextCtrl = {
					name: 'summary',
					type: 'textarea',
					label: translate("tinymce-upload-summary-label"),
					tooltip: translate("tinymce-upload-summary-tooltip"),
				},
				linkTextCtrl = {
					name: 'link',
					type: 'input',
					label: translate("tinymce-upload-link-label"),
					tooltip: translate("tinymce-upload-link-tooltip")
				},
				altTextCtrl = {
					name: 'alt',
					type: 'input',
					label: translate("tinymce-upload-alttext-label"),
					tooltip: translate("tinymce-upload-alttext-tooltip"),
				},
				imageDimensionsCtrl = {
					name: 'dimensions',
					type: 'sizeinput',
					label: translate("tinymce-upload-dimensions-constrain-text"),
					tooltip: translate("tinymce-upload-dimensions-tooltip"),
				},
				verticalAlignListCtrl = {
					name   : 'verticalalignment',
					type   : 'selectbox',
					label  : translate("tinymce-upload-vertalign-label"),
					tooltip: translate("tinymce-upload-vertalign-tooltip"),
					items :
						[
							{ text: "", value: '' },
							{ text: translate("tinymce-upload-vertalign-middle-text"), value: 'middle' },
							{ text: translate("tinymce-upload-vertalign-top-text"), value: 'top' },
							{ text: translate("tinymce-upload-vertalign-bottom-text"), value: 'bottom' },
							{ text: translate("tinymce-upload-vertalign-baseline-text"), value: 'baseline' },
							{ text: translate("tinymce-upload-vertalign-sub-text"), value: 'sub' },
							{ text: translate("tinymce-upload-vertalign-super-text"), value: 'super' },
							{ text: translate("tinymce-upload-vertalign-texttop-text"), value: 'text-top' },
							{ text: translate("tinymce-upload-vertalign-textbottom-text"), value: 'text-bottom'}
						]
				},
				horizontalAlignListCtrl = {
					name   : 'horizontalalignment',
					type   : 'selectbox',
					label  : translate("tinymce-upload-horizontalalign-label"),
					tooltip: translate("tinymce-upload-horizontalalign-tooltip"),
					items :
						[
							{ text: "", value: '' },
							{ text: translate("tinymce-upload-horizontalalign-left-text"), value: 'left' },
							{ text: translate("tinymce-upload-horizontalalign-centre-text"), value: 'center' },
							{ text: translate("tinymce-upload-horizontalalign-right-text"), value: 'right' },
							{ text: translate("tinymce-upload-horizontalalign-none-text"), value: 'none'}
						]
				},
				formatListCtrl = {
					name   : 'format',
					type   : 'selectbox',
					label  : translate("tinymce-upload-format-label"),
					tooltip: translate("tinymce-upload-format-tooltip"),
					items :
						[
							{ text: translate("tinymce-upload-format-thumb-text"), value: 'thumb' },
							{ text: translate("tinymce-upload-format-border-text"), value: 'border' },
							{ text: translate("tinymce-upload-format-frame-text"), value: 'frame' },
							{ text: translate("tinymce-upload-format-frameless-text"), value: 'frameless'},
							{ text: translate("tinymce-upload-format-none-text"), value: '' }
						]
				},
				fileDialogItems = [
					typeListCtrl,
					fileSrcCtrl,
					destTextCtrl,
					titleTextCtrl,
					summaryTextCtrl,
				],
				urlDialogItems = [
					typeListCtrl,
					urlSrcCtrl,
					destTextCtrl,
					titleTextCtrl,
					summaryTextCtrl,
				],
				wikiDialogItems = [
						typeListCtrl,
						wikiSrcCtrl,
						destTextCtrl,
						titleTextCtrl,
						dummySummary,
					],
				displayDialogItems = [
						typeListCtrl,
						displaySrcCtrl,
						destTextCtrl,
						titleTextCtrl,
						summaryTextCtrl,
					],
				overwriteDialogItems = [
						overwriteCtrl,
						displayOverwriteFile,
					],
				imageDialogItems = [
					displaySrcCtrl,
					titleTextCtrl,
					linkTextCtrl,
					altTextCtrl,
					imageDimensionsCtrl,
					verticalAlignListCtrl,
					horizontalAlignListCtrl,
					formatListCtrl
				],
				dialogButtons = [
					{
						type: 'cancel',
						name: 'closeButton',
						text: translate("tinymce-cancel")
					},
					{
						type: 'submit',
						name: 'submitButton',
						text: translate("tinymce-ok"),
						primary: true
					}
				],
				overwriteDialogButtons = [
					{
						type: 'cancel',
						name: 'closeButton',
						text: translate("tinymce-cancel")
					},
					{
						type: 'custom',
						name: 'overwrite',
						text: translate("tinymce-upload-button-label-overwrite")
					},
					{
						type: 'custom',
						name: 'use',
						text: translate("tinymce-upload-button-label-use")
					},
					{
						type: 'custom',
						name: 'rename',
						text: translate("tinymce-upload-button-label-rename")
					}
				],
				imageDialogBody = {
					type: 'panel', 
					items: imageDialogItems
				},	
				overwriteDialogBody = {
					type: 'panel', 
					items: overwriteDialogItems
				},	
				newImageDialogBody = function( dialogTypeItems ){
					return {
					type: 'tabpanel', 
					tabs: [
						{
							name: 'general',
							title: translate("tinymce-upload-title-general"),
							items: dialogTypeItems
						},
						{
							name: 'image',
							title: translate("tinymce-upload-title-image"),
							pack: 'start',
							items: imageDialogItems
						}
					]
				}};

			/**
			 * check if files of with given extension are allowed to be uploaded
			 *
			 * @param {String} text
			 * @returns {String}
			 */
			function checkFileExtensionIsAllowed(extension) {
				var checkFileExtensions = (mw.config.get( 'wgCheckFileExtensions' )),
					strictFileExtensions = (mw.config.get( 'wgStrictFileExtensions' )),
					allowedsFileExtensions = (mw.config.get( 'wgFileExtensions' )),
					disallowedsFileExtensions = (mw.config.get( 'wgFileBlacklist' )),
					extensionAllowed;
	  
				if (disallowedsFileExtensions) {
					if ( disallowedsFileExtensions.indexOf( extension.toLowerCase() ) > -1 ){
						return false;
					}
				}
	  
				extensionAllowed = true;
				if (checkFileExtensions) {
					if (strictFileExtensions) {
						extensionAllowed = false;
						if ( allowedsFileExtensions.indexOf( extension.toLowerCase() ) > -1){
							extensionAllowed = true;
						}
					}
				}
				
				return extensionAllowed;
			}
	  
			/**
			 * cleans submitted data to ensure all datatypes are valid
			 *
			 * @param {String} text
			 * @returns {String}
			 */
			function cleanSubmittedData(submittedData) {
//				if (!Array.isArray( submittedData["dimensions"] )) submittedData["dimensions"] = [];
				if (!submittedData.type) submittedData.type = '';
				if (!submittedData.fileSrc) submittedData.fileSrc = {meta:{},value:''};
				if (!submittedData.urlSrc) submittedData.urlSrc = '';
				if (!submittedData.wikiSrc) submittedData.wikiSrc = '';
				if (!submittedData.displaySrc) submittedData.displaySrc = '';
				if (!submittedData.dest) {
					if (submittedData.type == 'File' ) {
						submittedData.dest = submittedData.displaySrc;
					} else if (submittedData.type == 'URL' ) {
						submittedData.dest = submittedData.urlSrc;
					} else if (submittedData.type == 'Wiki' ) {
						submittedData.dest = submittedData.wikiSrc;
					} else{
						submittedData.dest = submittedData.displaySrc;
					};
				};
				if (!submittedData.title) submittedData.title = '';
				if (!submittedData.dimensions["width"]) submittedData.dimensions["width"] = "";
				if (!submittedData.dimensions["height"]) submittedData.dimensions["height"] = "";
				if (!submittedData.summary) submittedData.summary = '';
				if (!submittedData.alt) submittedData.alt = '';
				if (!submittedData.link) submittedData.link = '';
//				if (!submittedData.horizontalalignment) submittedData.horizontalalignment = 'right';
				if (!submittedData.horizontalalignment) submittedData.horizontalalignment = '';
//				if (!submittedData.verticalalignment) submittedData.verticalalignment = 'middle';
				if (!submittedData.verticalalignment) submittedData.verticalalignment = '';
				if (!submittedData.format) submittedData.format = 'thumb';
				if (!submittedData.overwriteFile) submittedData.overwriteFile = '';
				return submittedData;
			}
	  
			/**
			 * get details of file already uploaded to wiki including url
			 *
			 * @param {String} text
			 * @returns {String}
			 */
			function getFileDetailsFromWiki(fileName) {
				var fileDetails = false,
					queryData = new FormData();

				queryData.append("action", "query");
				queryData.append("prop", "imageinfo");
				queryData.append("iiprop", "url");
				queryData.append("iiurlwidth", _userThumbsize);
				queryData.append("titles", fileName);
				queryData.append("format", "json");
				
				//as we now have created the data to send, we send it...
				$.ajax( { 
					url: _mwtWikiApi,
					contentType:false,
					processData:false,
					type:'POST',
					data: queryData,//the queryData object we created above
					async: false,
					success:function(data){
						if (typeof data.query == "undefined") {
							fileDetails = JSON.parse(data)
						} else if (typeof data.query.pages != "undefined") {
							var pages = data.query.pages;
							for( var page in pages ) {
								if ((typeof pages[page].missing == "undefined") && (typeof pages[page].invalid == "undefined") ) {
									var pageTitle = pages[page].title
									if (typeof pages[page].imageinfo == "undefined") {
										imageURL = title;
									} else {
										var imageInfo = pages[page].imageinfo;
										if (typeof imageInfo[0].thumburl == "undefined") {
											imageURL = imageInfo[0].url;
										} else {
											imageURL = imageInfo[0].thumburl;							
										}
									}
									// check file name of found page matches
									if (pageTitle.replace(/_/g," ").toLowerCase().split(':').pop() == 
										fileName.replace(/_/g," ").toLowerCase().split(':').pop()) {
										fileDetails = imageURL;
									}
								}
							}
						}
					},
					error:function(xhr,status, error){
					}
				});
				return fileDetails;
			}
	  
			/**
			 * callback for to check source and destination for upload
			 *
			 * @param {String} text
			 * @returns {String}
			 */
			function uploadCheck( api ) {

				var dialogData = api.getData(),
					type = dialogData.type,
					srcURL = dialogData.urlSrc,
					destURL = dialogData.dest,
					destinationFile = _mwtFileNamespace + ':' + destURL,
					destinationFileDetails = getFileDetailsFromWiki(destinationFile);

				var file,
					extension,
					dialogItems;

				if ( type == 'File' ) {
					srcURL = dialogData.displaySrc;
					dialogItems = fileDialogItems;
				} else if ( type == 'URL' ) {
					srcURL = dialogData.urlSrc;
					dialogItems = urlDialogItems;
				} else if ( type == 'Wiki' ) {
					srcURL = dialogData.wikiSrc;
					dialogItems = wikiDialogItems;
				} else {
					srcURL = dialogData.displaySrc;
					dialogItems = wikiDialogItems;
				};

				if (srcURL) {
					file = srcURL.split('/').pop().split('#')[0].split('?')[0].split('!')[0];
					extension = file.split('.').pop();
				} else {
					editor.windowManager.alert(translate("tinymce-upload-alert-file-source-empty"));
					dialogData = initialiseDialogData( '' );
					dialogData.type = type;
					api.redial( makeDialog( newImageDialogBody( dialogItems ), dialogData ));
					return false;				
				}

				if (!checkFileExtensionIsAllowed( extension )) {
					editor.windowManager.alert(translate("tinymce-upload-alert-file-type-not-allowed"));
					dialogData = initialiseDialogData( '' );
					dialogData.type = type;
					api.redial( makeDialog( newImageDialogBody( dialogItems ), dialogData ));
					return false;
				}

				// encountered an error trying to access the api
				if (typeof destinationFileDetails.error != "undefined") {
						editor.windowManager.alert(translate("tinymce-upload-alert-error-uploading-to-wiki"));
						dialogData = initialiseDialogData( '' );
						dialogData.type = type;
						api.redial( makeDialog( newImageDialogBody( dialogItems ), dialogData ));
					return false;
				}
	  
				if (type == 'File' || type == 'URL') { 
					// file is to be uploaded
					if (destinationFileDetails) { 
						// file of this name already exists on this wiki
						_savedOverWriteInput = dialogData;
						ignoreWarnings = false;
						dialogData.type = 'Overwrite';
						dialogData.overwriteCtrl = '<div style="font-family:sans-serif;font-size:smaller">' 
							+ translate("tinymce-upload-confirm-file-name-already-exists") + '</div>';
						dialogData.overwriteFile = 
							'<div style="display: flex">'
								+ '<div style="width:50%;padding:5px;font-family:sans-serif;font-size:smaller">'
								+ translate("tinymce-upload-source-label")
									+ '<img src="' 
									  + _srcvalue 
									  + '" style="margin-left:auto; margin-right:auto; display:block; vertical-align:middle; height:108px;">'
								+ '</div>'
								+ '<div style="width:50%;padding:5px;font-family:sans-serif;font-size:smaller">'
								+ translate("tinymce-upload-type-label-wiki")
									+ '<img src="' 
									  + destinationFileDetails 
									  + '" style="margin-left:auto; margin-right:auto; display:block; vertical-align:middle; height:108px;">'
								+ '</div>'
							+ '</div>';

						api.redial( makeDialog( overwriteDialogBody, dialogData, 'overwrite' ));
						return false;
					}
				} else if (type == 'Wiki') {
					if (!destinationFileDetails) {
						editor.windowManager.confirm(translate("tinymce-upload-confirm-file-not-on-wiki"),
							function(ok) {
								if (ok) {
									dialogData = initialiseDialogData( '' );
									dialogData.type = type;
									api.redial( makeDialog( newImageDialogBody( dialogItems ), dialogData ));
									return false;
								} else {
									dialogData = initialiseDialogData( '' );
									dialogData.type = type;
									api.redial( makeDialog( newImageDialogBody( dialogItems ), dialogData ));
									return false;
								}
							});
					}
				} else if (type == 'Overwrite') {
					ignoreWarnings == true;
				}
				return true;
			}

			/**
			 * Creates the wikilink and inserts it's html equivalent into
			  the page
			 *
			 * @param {String} text
			 * @returns {String}
			 */
			function insertUpload( uploadPage, dialogData ) {
				var wikitext = '',
					extension;
					
				//check to see if uploaded file is an image or not
				extension = uploadPage.split('.').pop();
				
				//set up wiki text for inserting or updating in editor window
				wikitext += "[[" + uploadPage;
				
				if ( _imageFileExtensions.indexOf( extension) > -1 ) {
					// add additional image attributes if image file
					if ( dialogData.dimensions.width <= 0) {
						dialogData.dimensions.width = _userThumbsize;
					}
					if (dialogData.dimensions.width > 0) {
						wikitext += "|" + dialogData.dimensions.width;
						if (dialogData.dimensions.height > 0 ) {
							wikitext += "x" + dialogData.dimensions.height + "px";
						} else {
						wikitext += "px"
						}
					} else if (dialogData.dimensions.height > 0) {
						wikitext += "|x" + dialogData.dimensions.height + "px";
					}
					if (dialogData.link) {
						wikitext += "|link=" + dialogData.link;
					}
					if (dialogData.alt) {
						wikitext += "|alt=" + dialogData.alt;
					}
					if (dialogData.horizontalalignment) {
						wikitext += "|" + dialogData.horizontalalignment;
					}
					if (dialogData.verticalalignment) {
						wikitext += "|" + dialogData.verticalalignment;
					}
					if (dialogData.format) {
						wikitext += "|" + dialogData.format;
					}
				}
				if (dialogData.title) {
					wikitext += "|" + dialogData.title;
				}
				wikitext += "]]";

				var	editor = tinymce.activeEditor,
					parentNode;
				editor.focus( );
				// OK this was interesting.  Insert an image in a <p> block that is preserved html
				// within a table cell that isn't preserved html, removes the <p> block and also
				// makes the cell preserved html - which breaks stuff.  This traps this condition
/*				if (tinymce.DOM.is( editor.selection.getNode(), 'P' )) {
//					tinymce.DOM.removeClass( editor.selection.getNode(), 'mwt-preserveHtml' );
					tinymce.DOM.rename( editor.selection.getNode(), 'div' );
				}*/
				editor.insertContent(wikitext, {format: 'wiki', convert2html: 'true', mode: 'inline'} );
				editor.focus( );
				editor.nodeChanged();	
				return;
			}

			/**
			 * callback for dialog type change
			 *
			 * @param {String} text
			 * @returns {String}
			 */
			function typeChange( api ) {
				var dialogData = api.getData(),
					type = dialogData.type;

				// initialise the dialog datat
				dialogData = initialiseDialogData( '' );
				dialogData.type = type;
				
				// display dialog fields appropriate for type
				if (type == 'File') { 
					// local Fle upload
					api.redial( makeDialog( newImageDialogBody( fileDialogItems ), dialogData ) );
				} else if (type == 'URL') { 
					// URL upload
					if (!uploadPersmissions.userMayUploadFromURL) {
						dialogData.type = 'File';
						editor.windowManager.alert(translate("tinymce-upload-alert-uploads-not-allowed"));
						api.redial( makeDialog( newImageDialogBody( fileDialogItems ), dialogData ));
					} else {
						api.redial( makeDialog( newImageDialogBody( urlDialogItems ), dialogData  ));
					}
				} else if (type == 'Wiki') { 
				// file already uploaded to wiki
					api.redial( makeDialog( newImageDialogBody( wikiDialogItems ), dialogData ));
				}
				return;
			}
	  
			/**
			 * callback for when dialog file source has changed
			 *
			 * @param {String} text
			 * @returns {String}
			 */
			function fileSrcChange( api ) {
				var dialogData = api.getData(),
					data = dialogData,
					meta = dialogData.fileSrc.meta,
					fileType;

				var srcURL,
					prependURL,
					absoluteURLPattern,
					file,
					extension;

				if (meta.src) {
					srcURL = meta.src;
				} else {
					srcURL = _srcvalue;
					editor.windowManager.alert('"' + srcURL + '" is not a valid input, Please use the file picker to select the file you wish to upload' );
					data.fileSrc = {meta:{},value:''};
					api.redial( makeDialog( newImageDialogBody( fileDialogItems ), data ));
					return;
				}
				srcURL = editor.convertURL( srcURL );
				// Pattern test the src url and make sure we haven't already prepended the url
				prependURL = editor.settings.image_prepend_url;
				absoluteURLPattern = new RegExp('^(?:[a-z]+:)?//', 'i');
				if (prependURL && !absoluteURLPattern.test(srcURL) && 
					srcURL.substring(0, prependURL.length) !== prependURL) {
					srcURL = prependURL + srcURL;
				}

				file = srcURL.split('/').pop().split('#')[0].split('?')[0].split('!')[0];
				extension = file.split('.').pop();

				if (!checkFileExtensionIsAllowed(extension)) {
					editor.windowManager.alert(translate("tinymce-upload-alert-file-type-not-allowed"));
					data.fileSrc = {meta:{},value:''};
					api.redial( makeDialog( newImageDialogBody( fileDialogItems ), data ));
					return;
				}

				// if this is an image to upload then set the source content globals
				if ( meta.srccontent ) {
					_srccontent = meta.srccontent;
					_srcvalue = dialogData.fileSrc.value;
				}
				if ( meta.srccontent.type ) {
					fileType = meta.srccontent.type;
				}

				//reset the value of this field to the propper src name which is striped of its path
				data.displaySrc = srcURL;

 				 //reset the value of destination field to the propper src name which is striped of its path
				data.dest = srcURL;
				
				api.redial( makeDialog( newImageDialogBody( displayDialogItems ), data ));
			}

			/**
			 * callback for when dialog url source has changed
			 *
			 * @param {String} text
			 * @returns {String}
			 */
			function urlSrcChange( api ) {
				var dialogData = api.getData(),
					srcURL = dialogData.urlSrc,
					file;

				file = srcURL.split('/').pop().split('#')[0].split('?')[0].split('!')[0];

 				 //reset the value of destination field to the propper src name which is striped of its path
				dialogData.dest = srcURL;
				dialogData.displaySrc = srcURL;
				
				api.redial( makeDialog( newImageDialogBody( urlDialogItems ), dialogData ));
				api.focus( 'urlSrc' );
			}

			/**
			 * callback for when dialog wiki source has changed
			 *
			 * @param {String} text
			 * @returns {String}
			 */
			function wikiSrcChange( api ) {
				var dialogData = api.getData(),
					srcURL = dialogData.wikiSrc,
					file;

				file = srcURL.split('/').pop().split('#')[0].split('?')[0].split('!')[0];

 				 //reset the value of destination field to the propper src name which is striped of its path
				dialogData.dest = srcURL;
				dialogData.displaySrc = srcURL;
				
				api.redial( makeDialog( newImageDialogBody( wikiDialogItems ), dialogData ));
				api.focus( 'wikiSrc' );
			}

			/**
			 * callback for when dialog wiki source has changed
			 *
			 * @param {String} text
			 * @returns {String}
			 */
			function overwriteExistingFile( api ) {
				var dialogData = _savedOverWriteInput,
					ignoreWarnings = true,
					uploadDetails,
					result;
					
				dialogData.type = 'File';
				fileContent = _srccontent;
				fileType = dialogData.type;
				fileName = dialogData.dest.split('/').pop().split('#')[0].split('?')[0].split('!')[0].replace(/\s/gmi,'_');
				fileSummary = dialogData.summary;
				uploadDetails = doUpload(fileType, fileContent, fileName, fileSummary, ignoreWarnings);
				result = checkUploadDetail( editor, uploadDetails, ignoreWarnings, fileName );
				if (result[ "state" ] != "error" ) {
					uploadPage = _mwtFileNamespace + ":" + fileName;
					insertUpload( uploadPage, dialogData );
				}

				// close the dialog window
				api.close();
			}

			/**
			 * callback for when dialog wiki source has changed
			 *
			 * @param {String} text
			 * @returns {String}
			 */
			function useExistingFile( api ) {
				var dialogData = _savedOverWriteInput,
					uploadPage;

				uploadPage = _mwtFileNamespace + ":" + dialogData.dest;
				
				insertUpload( uploadPage, dialogData );

				// close the dialog window
				api.close();
				
			}
	  
			/**
			 * callback for when dialog wiki source has changed
			 *
			 * @param {String} text
			 * @returns {String}
			 */
			function renameSourceFile( api ) {
				var dialogData = _savedOverWriteInput;
				api.redial( makeDialog( newImageDialogBody( displayDialogItems ), dialogData ));
			}
	  
			/**
			 * initialise dialog data
			 *
			 * @param {String} text
			 * @returns {String}
			 */
			function initialiseDialogData( dialogData ) {
				// set up defaults using previously enterred data if any
				
				if (!Array.isArray( dialogData )) dialogData = [];
				if (!Array.isArray( dialogData["dimensions"] )) dialogData["dimensions"] = [];
				if (!dialogData.type) dialogData.type = 'File';
				if (!dialogData.fileSrc) dialogData.fileSrc = {meta:{},value:''};
				if (!dialogData.urlSrc) dialogData.urlSrc = '';
				if (!dialogData.wikiSrc) dialogData.wikiSrc = '';
				if (!dialogData.displaySrc) dialogData.displaySrc = '';
				if (!dialogData.dest) dialogData.dest = '';
				if (!dialogData.title) dialogData.title = '';
				if (!dialogData.summary) dialogData.summary = '';
				if (!dialogData.link) dialogData.link = '';
				if (!dialogData.alt) dialogData.alt = '';
				if (!dialogData.dimensions["width"]) dialogData.dimensions["width"] = "";
				if (!dialogData.dimensions["height"]) dialogData.dimensions["height"] = "";
//				if (!dialogData.horizontalalignment) dialogData.horizontalalignment = 'right';
				if (!dialogData.horizontalalignment) dialogData.horizontalalignment = '';
//				if (!dialogData.verticalalignment) dialogData.verticalalignment = 'middle';
				if (!dialogData.verticalalignment) dialogData.verticalalignment = '';
				if (!dialogData.format) dialogData.format = 'thumb';
				if (!dialogData.overwriteFile) dialogData.overwriteFile = '';
				return dialogData;
			}

			dialogData = initialiseDialogData( dialogData );

			// populate form with details of existing upload if one selected
			if (imgElm) { 
				dialogData.type = 'Wiki';
				wikiImageObject.horizontalalignment = '';
				wikiImageObject.verticalalignment = '';
				wikiImageObject.format = '';
				aLink = dom.getAttrib(imgElm, 'data-mwt-wikitext');
				aLink = aLink.replace(/<@@bnl@@>/gmi,"");
				// remove brackets and split into patrts
				parts = aLink.substr(2, aLink.length - 4).split("|"); 
				wikiImageObject.imagename = parts[0];
				for (var i = 1; i < parts.length; i++) {
					part = parts[i];
					if (part.substr(part.length - 2, 2) == 'px') {
						// Hint: frame ignores size but we want to keep this information
						// See: mediawiki.org/wiki/Help:Images#Size_and_frame
		
						// 100x200px -> 100x200
						unsuffixedValue = part.substr(0, part.length - 2);
						// 100x200 -> [100,200]
						dimensions = unsuffixedValue.split('x');
						if (dimensions.length === 2) {
							wikiImageObject.sizewidth = (dimensions[0] === '') ? false : dimensions[0];
							wikiImageObject.sizeheight = dimensions[1];
						} else {
							wikiImageObject.sizewidth = unsuffixedValue;
						}
						continue;
					}
		
					if ($.inArray(part, ['right']) !== -1) {
						wikiImageObject.horizontalalignment = 'right';
						continue;
					}
		
					if ($.inArray(part, ['left']) !== -1) {
						wikiImageObject.horizontalalignment = 'left';
						continue;
					}
		
					if ($.inArray(part, ['center']) !== -1) {
						wikiImageObject.horizontalalignment = 'center';
						continue;
					}
		
					if ($.inArray(part, ['none']) !== -1) {
						wikiImageObject.horizontalalignment = 'none';
						continue;
					}
		
					if ($.inArray(part, ['middle']) !== -1) {
						wikiImageObject.verticalalign = 'middle';
						continue;
					}
		
					if ($.inArray(part, ['top']) !== -1) {
						wikiImageObject.verticalalign = 'top';
						continue;
					}
		
					if ($.inArray(part, ['bottom']) !== -1) {
						wikiImageObject.verticalalign = 'bottom';
						continue;
					}
		
					if ($.inArray(part, ['baseline']) !== -1) {
						wikiImageObject.verticalalign = 'baseline';
						continue;
					}
		
					if ($.inArray(part, ['sub']) !== -1) {
						wikiImageObject.verticalalign = 'sub';
						continue;
					}
		
					if ($.inArray(part, ['super']) !== -1) {
						wikiImageObject.verticalalign = 'super';
						continue;
					}
		
					if ($.inArray(part, ['text-top']) !== -1) {
						wikiImageObject.verticalalign = 'text-top';
						continue;
					}
		
					if ($.inArray(part, ['text-bottom']) !== -1) {
						wikiImageObject.verticalalign = 'text-bottom';
						continue;
					}
		
					if ($.inArray(part, ['thumb']) !== -1) {
						wikiImageObject.format = 'thumb';
						continue;
					}
		
					if ($.inArray(part, ['frame']) !== -1) {
						wikiImageObject.format = 'frame';
						continue;
					}
		
					if ($.inArray(part, ['frameless']) !== -1) {
						wikiImageObject.format = 'frameless';
						continue;
					}
		
					if ($.inArray(part, ['border']) !== -1) {
						wikiImageObject.format = 'border';
						continue;
					}
		
					kvpair = part.split('=');
					if (kvpair.length === 1) {
						wikiImageObject.caption = part; //hopefully
						wikiImageObject.title = wikiImageObject.caption;
						continue;
					}
		
					key = kvpair[0];
					value = kvpair[1];
		
					if ($.inArray(key, ['link']) !== -1) {
						wikiImageObject.link = value;
						continue;
					}
		
					if ($.inArray(key, ['title']) !== -1) {
						wikiImageObject.caption = value;
						wikiImageObject.title = value;
						continue;
					}
		
					if ($.inArray(key, ['caption']) !== -1) {
						wikiImageObject.caption = value;
						wikiImageObject.title = value;
						continue;
					}
		
					if ($.inArray(key, ['upright']) !== -1) {
						wikiImageObject.upright = value;
						continue;
					}
		
					if (key === 'alt') {
						wikiImageObject.alt = value;
						continue;
					}
				}

				dialogData.dimensions = [];
				dialogData.displaySrc = wikiImageObject.imagename;
				if (dialogData.displaySrc == undefined) dialogData.wikiSrc = '';
				dialogData.dest = dialogData.wikiSrc;
				dialogData.summary = '';
				dialogData.title = wikiImageObject.title;
				if ( dialogData.title == undefined) dialogData.title = '';
				dialogData.link = wikiImageObject.link;
				if (dialogData.link == undefined) dialogData.link = '';
				dialogData.alt = wikiImageObject.alt;
				if ( dialogData.alt == undefined) dialogData.alt = '';
				dialogData.dimensions["width"] = wikiImageObject.sizewidth;
				if ( !dialogData.dimensions["width"]) dialogData.dimensions["width"] = "";
				dialogData.dimensions["height"] = wikiImageObject.sizeheight;
				if ( !dialogData.dimensions["height"]) dialogData.dimensions["height"] = "";
				dialogData.horizontalalignment = wikiImageObject.horizontalalignment;
				if ( dialogData.horizontalalignment == undefined) dialogData.horizontalalignment = null;
				dialogData.verticalalignment = wikiImageObject.verticalalignment;
				if ( dialogData.verticalalignment == undefined) dialogData.verticalalignment = null;
				dialogData.format = wikiImageObject.format;
				if ( dialogData.format == undefined) dialogData.format = '';
				dialogData.style = editor.dom.serializeStyle(editor.dom.parseStyle(editor.dom.getAttrib(imgElm, 'style')));
			}

			// setup the list of upload types according to user permissions
			if (uploadPersmissions.userMayUpload) {
				typelist.push({text: translate("tinymce-upload-type-label-file"), value: "File"});
				if (uploadPersmissions.userMayUploadFromURL) {
					typelist.push({text: translate("tinymce-upload-type-label-url"), value: "URL"});
				}
			}
			typelist.push({text: translate("tinymce-upload-type-label-wiki"), value: "Wiki"});
			if (!uploadPersmissions.userMayUpload) dialogData.type = "Wiki";

			var onDialogChange = function(api, changed) {
				switch(changed.name) {
					case 'type':
						// type of upload has changed
						typeChange( api );
						break;
					case 'fileSrc':
						// type of upload has changed
						fileSrcChange( api );
						break;
					case 'urlSrc':
						// type of upload has changed
						urlSrcChange( api );
						break;
					case 'wikiSrc':
						// type of upload has changed
						wikiSrcChange( api );
						break;
					}
			};

			var onOverwriteAction = function(api, changed) {
				switch(changed.name) {
					case 'overwrite':
						// type of upload has changed
						overwriteExistingFile( api );
						break;
					case 'use':
						// type of upload has changed
						useExistingFile( api );
						break;
					case 'rename':
						// type of upload has changed
						renameSourceFile( api );
						break;
					}
			};

			var onDialogTabChange = function( api, changed ) {
				// this is triggered when redialing the dialog as well as
				// when the tab changes, so we test to see if we have 
				// moved from the general tab otherwise we ignore
				if ( changed.newTabName != "general" ) {
					if (!uploadCheck( api ))
						return;
				}
			};

			var onSubmitForm = function( api ) {
				var dialogData = api.getData(),
					srcURL = dialogData.wikiSrc,
					figureElm,
					result,
					uploadDetails,
					uploadResult,
					uploadPage,
					fileType,
					fileContent,
					fileName,
					fileSummary,
					ignoreWarnings,
					wikitext = '',
					html;
	
				// first check source and destination details are valid
				if (!uploadCheck( api )) {

					return;
				}

				dialogData = cleanSubmittedData( dialogData );
				uploadDetails = [];
				result = [];
				uploadResult = '';
				uploadPage = '';
				ignoreWarnings = false;

				// have to have a destination name unless editing previous upload
				if (!dialogData.dest && !imgElm) {
					// user may have clicked submit without exiting source field
					editor.windowManager.alert(translate("tinymce-upload-alert-destination-filename-needed"));
					return;
				}
	
				if (imgElm) { // Editing image node so skip upload
					uploadPage = dialogData.displaySrc;
				} else {
					if ( dialogData.overwriteFile ) {
						dialogData.type = 'File';
						ignoreWarnings = true;
					}
					if ((dialogData.type == 'File') 
							|| (dialogData.type == 'URL')) {
						if (dialogData.type == 'File') {
							fileContent = _srccontent;
						} else {
							fileContent = dialogData.urlSrc;
						}
						fileType = dialogData.type;
						fileName = dialogData.dest.split('/').pop().split('#')[0].split('?')[0].split('!')[0].replace(/\s/gmi,'_');
						fileSummary = dialogData.summary;
						if ((fileContent) && (fileName)) {
							do {
								uploadDetails = doUpload(fileType, fileContent, fileName, fileSummary, ignoreWarnings);
								result = checkUploadDetail( editor, uploadDetails, ignoreWarnings, fileName );
								if (( result[ "state" ] == 'ok') || ( result[ "state" ] == 'duplicate')) {
									uploadResult = result["url"];
									uploadPage = result["page"];
									ignoreWarnings = false;
								} else if ( result[ "state" ] == 'exists') {
									dialogData.type = 'Wiki';
									dialogData.wikiSrc = dialogData.displaySrc;
//									dialogData.overwriteFile = '<img src="' + destinationFileDetails + '" style="margin-left:auto; margin-right:auto; display:block; vertical-align:middle;	height:135px;">';
//										api.redial( makeDialog( overwriteDialogBody, dialogData ));
//									} else {
										api.redial( makeDialog( newImageDialogBody( displayDialogItems ), dialogData ));
//									}
									ignoreWarnings = false;								
								} else {
									ignoreWarnings = false;								
								}
							} while (ignoreWarnings)
							if (result[ "state" ] === "error" ) {
								return;
							}
						} else {
							editor.windowManager.alert(translate("tinymce-upload-alert-source-or-destination-undefined"));
							return;
						}
					} else if ((dialogData.type == 'Wiki') || (dialogData.type == '')) {
						fileName = dialogData.dest;
						uploadPage = _mwtFileNamespace + ":" + fileName;
					}
				}

				insertUpload( uploadPage, dialogData );

				// close the dialog window
				api.close();
				
				return;
			}

			var makeDialog = function ( uploadDialogBody, initialData, action ) {
				var footerButtons = dialogButtons;

				if ( !allow_external_targets ) {
					// remove the link item if extenal links not allowed
					if ( uploadDialogBody.tabs ) { 
						uploadDialogBody.tabs[1].items.splice(2,1);
					} else {
						uploadDialogBody.items.splice(2,1);					
					}
				}

				if ( action == 'overwrite' ) {
					footerButtons = overwriteDialogButtons;
				}

				return {
					title: translate( "tinymce-upload-title" ),
					size: 'normal',
					body: uploadDialogBody,
					buttons: footerButtons,
					initialData: initialData,
					onChange: onDialogChange,
					onTabChange: onDialogTabChange,
					onAction: onOverwriteAction,
					onSubmit: onSubmitForm,
				};
			};

			var makeOverwriteDialog = function ( uploadDialogBody, initialData ) {

				if ( !allow_external_targets ) {
					// remove the link item if extenal links not allowed
					uploadDialogBody.tabs[1].items.splice(2,1);
				}

				return {
					title: translate( "tinymce-upload-title" ),
					size: 'normal',
					body: uploadDialogBody,
					buttons: overwriteDialogButtons,
					initialData: initialData,
					onAction: onOverwriteAction,
				};
			};

			var uploadDialogTitle,
				uploadDialogBody;

			if ( imgElm ) { // edit existing image display
				uploadDialogBody = imageDialogBody;
			} else { // new upload
				uploadDialogBody = newImageDialogBody( fileDialogItems );
			}

			var uploadDialog = editor.windowManager.open( makeDialog( uploadDialogBody, dialogData ));
		}

		// abort if permissions not Ok
		uploadPersmissions = _mwtCheckUploadPermissions(editor);
		if ( !uploadPersmissions.uploadsAllowed ) return;
		
		imgElm = editor.selection.getNode();
		figureElm = dom.getParent(imgElm, 'figure.image');

		// if node is a link to an image then get the image
		if (figureElm) {
			imgElm = dom.select('img', figureElm)[0];
		}

		// test if we are modifying an existing upload else set to null
		if (imgElm && (imgElm.className.indexOf("mwt-image") < 0 
			|| imgElm.getAttribute('data-mce-object') 
			|| imgElm.getAttribute('data-mce-placeholder'))) {
			imgElm = null;
		}

		//display and process upload form
		displayUploadForm(dialogData, imgElm);
	};

	var registerCommands = function ( editor ) {
		editor.addCommand('wikiupload', function () {
			upload( editor );
		});
	}
	
	var registerKeys = function ( editor ) {
		editor.ui.registry.addButton('wikiupload', {
			icon: 'image',
			tooltip: translate("tinymce-upload-menu-item-text"),
			onAction: function () {
				return upload( editor );
			},
			stateSelector: '.mwt-image'
		});
	
		editor.ui.registry.addMenuItem('wikiupload', {
			icon: 'image',
			text: translate("tinymce-upload-menu-item-text"),
			onAction: function () {
				return upload( editor );
			},
			context: 'upload',
			prependToContext: true
		});
	};

	this.init = function(editor) {
		registerCommands ( editor );
		registerKeys ( editor );
	}
};

tinymce.PluginManager.add('wikiupload', wikiupload);
