/**
 * Copyright (c) Aoxomoxoa Ltd. All rights reserved.
 * Licensed under the LGPL license.
 * For LGPL see License.txt in the project root for license information.
 *
 * mw_wikireference plugin
 *
 * Version: 1.0.0 (2020-08-01)
 */
(function () {
	'use strict';

	var pluginManager = tinymce.util.Tools.resolve('tinymce.PluginManager');

	var	editor = tinymce.activeEditor;

	var extensionTagsList = editor.getParam("wiki_extension_tags_list");
	
	var utility = editor.getParam("wiki_utility");

	var getSelection = utility.getSelection;

	var setSelection = utility.setSelection;
	
	var createUniqueNumber = utility.createUniqueNumber;

	var toggleEnabledState = utility.toggleEnabledState;

	var translate = utility.translate;
	
	var insertReference = function ( editor, type, times ) {

		function fix_selection(range) {
			var selection = editor.selection.getSel(editor.selection.setRng( range )),
				selected = range.toString(),
				start = range.startOffset,
				end = range.endOffset;

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
			return range
		}

		var args = {format: 'wiki', mode: 'inline', convert2html: true, newRef: true},
			selectedNode = editor.selection.getNode(),
			classList = selectedNode.className.split(' '),
			reference,
			refHtml = ' ',
			bm,
			id = 'R' + createUniqueNumber();


		editor.selection.setRng( fix_selection( editor.selection.getRng() ));

		if ( type == 'reference' ) {
			if ( classList.includes( "mwt-reference" )) {
				alert( translate( "tinymce-reference-alert-not-allowed" ));
				return;
			} else {
				refHtml = getSelection( editor, {format : 'html', convert2wiki : false});
			}
			if ( refHtml == '') refHtml = translate( "tinymce-reference-enterReferenceContent" );
			reference = '<ref>' + '<span class="mwt-dummyReference" contenteditable="true" id="' + id + '">' + refHtml + '</span></ref>';
	  
		} else if ( type = 'comment' ) {
			// comments are plain text so convert the content to wikitext
			refHtml = getSelection( editor, {format : 'html', convert2wiki : true});
			args = {format: 'html', mode: 'inline', convert2html: false};
			
			// create inner span that contains the content of the comment
			refHtml = 
				'<span class="mwt-editable mwt-reference mwt-comment'  
//				+ '" id="' + id
				+ '" data-mwt-type="comment"'
				+ '" draggable="false" contenteditable="true">' 
				+ refHtml
				+ '</span>';
			
			// create outer span that contains the visible comment placeholder
			reference = '<span class="mwt-placeHolder mwt-commentHolder mwt-showPlaceholder" title="' 
				+ translate( 'tinymce-editcomment' ) 
				+ '" data-mwt-type="comment" contenteditable="false" draggable="true" data-mwt-ref="' 
				+ id + '">' 
				+ refHtml 
				+ '</span>';
		}

		editor.insertContent(reference, args );
		editor.selection.select( editor.dom.select('#' + id )[0]); //select the inserted element
		editor.nodeChanged();

    };

	var toggleRefText = function ( editor ) {
		var selection = editor.selection.getNode(),
			id = editor.dom.getAttrib( selection, 'data-mwt-ref' ) ?  editor.dom.getAttrib( selection, 'data-mwt-ref' ): '' ;

		if ( id ) {
			selection = editor.selection.select( editor.dom.select('#' + id )[0] );
/*			editor.dom.toggleClass( editor.dom.select('#' + id )[0], 'mwt-showReference' );
			editor.selection.setCursorLocation( editor.selection.getNode());
			editor.selection.collapse( false );
*/
			editor.dom.toggleClass( selection, 'mwt-showReference' );
			editor.nodeChanged();
			editor.selection.setCursorLocation( editor.selection.getNode());
			editor.selection.collapse( false );
		}
	};

	var registerCommands = function ( editor ) {
		editor.addCommand( 'mwt-insertReference', function () {
			insertReference(editor, "reference", 1);
		});
		editor.addCommand( 'mwt-insertComment', function () {
			insertReference( editor, "comment", 1);
		});
		editor.addCommand( 'wikiToggleRefText', function () {
			toggleRefText( editor, 1 );
		});
	};

	var registerButtons = function (editor ) {
		var refSelectors = ["mwt-dummyReference", "mwt-reference"];
		var comSelectors = ["mwt-dummyReference", "mwt-comment"];

		editor.ui.registry.addToggleButton('reference', {
			icon: 'footnote',
			tooltip: translate( 'tinymce-reference-insertReference' ),
			onAction: function () {
				return editor.execCommand('mwt-insertReference');
			},
			onSetup: toggleEnabledState(editor, refSelectors, false )
		});
		editor.ui.registry.addMenuItem('reference', {
			icon: 'footnote',
			text: translate( 'tinymce-reference-insertReference' ),
			onAction: function () {
				return editor.execCommand('mwt-insertReference');
			}
		});
		editor.ui.registry.addToggleButton('comment', {
			icon: 'comment',
			tooltip: translate( 'tinymce-reference-insertComment' ),
			onAction: function () {
				return editor.execCommand('mwt-insertComment');
			},
			onSetup: toggleEnabledState(editor, comSelectors, false )
		});
		editor.ui.registry.addMenuItem('comment', {
			icon: 'comment',
			text: translate( 'tinymce-reference-insertComment' ),
			onAction: function () {
				return editor.execCommand('mwt-insertComment');
			}
		});
	};

    var setup = function (editor) {
		editor.on('keydown', function (evt) {
			if ( evt.keyCode == 56 ) {
				var html,
					args,
					element,
					outerHTML;
				if (( evt.ctrlKey == true ) && ( evt.shiftKey == true )) {
					editor.execCommand('mwt-insertReference');
				}
				return true;
			}
		});
    };


    function Plugin () {
		// only load plugin if the 'cite' extension is enabled
		// in the wiki, eg, if 'ref' tag is in extension tag list
		if ( extensionTagsList.split('|').indexOf('ref') > -1 ) {
			pluginManager.add('wikireference', function (editor) {
				registerCommands( editor );
				registerButtons( editor );
				setup( editor );
			});
		}
	}

    Plugin();

}());
