/**
 * Copyright (c) Aoxomoxoa Limited, Inc. All rights reserved.
 * Licensed under the LGPL.
 * For LGPL see License.txt in the project root for license information.
 *
 * mw_wikinonbreaking plugin
 *
 * Version: 1.0 (2020-08-01)
 *
 */
(function () {
	'use strict';

	var pluginManager = tinymce.util.Tools.resolve('tinymce.PluginManager');

	var	editor = tinymce.activeEditor;

	var utility = editor.getParam("wiki_utility");

	var setSelection = utility.setSelection;

	var translate = utility.translate;

	var insertNbsp = function (editor, times) {

		var args = {format: 'wiki', mode: 'inline', convert2html: true};
  
				editor.insertContent('&nbsp;', args );
				editor.focus( );
				editor.nodeChanged();	

    };

	var registerCommands = function (editor) {
		editor.addCommand('mwt-nonBreaking', function () {
			insertNbsp(editor, 1);
		});
	};

	var registerButtons = function (editor) {
		editor.ui.registry.addButton('nonbreaking', {
			icon: 'non-breaking',
			shortcut: 'Meta+K' + 32,
			tooltip: translate( 'tinymce-nonbreaking-insertNonBreakingSpace' ),
			onAction: function () {
				return editor.execCommand('mwt-nonBreaking');
			}
		});
		editor.ui.registry.addMenuItem('nonbreaking', {
			icon: 'non-breaking',
			text: translate( 'tinymce-nonbreaking-inserNonBreakingSpace' ),
			onAction: function () {
				return editor.execCommand('mwt-nonBreaking');
			}
		});
		editor.shortcuts.add('Meta+' + 32, 'insert non breaking space', function () {
			editor.execCommand('mwt-nonBreaking');
		});
	};

    var setup = function (editor) {
		editor.on('keydown', function (evt) {
			if ( evt.keyCode == 32 ) { // space key pressed
				var html,
					args,
					element,
					outerHTML;

				if (( evt.ctrlKey == true ) && ( evt.shiftKey == true )) {
					editor.execCommand('mwt-nonBreaking');
					evt.preventDefault();
				}
			} else if ( event.keyCode == 9 ) { // tab pressed
				if (( evt.ctrlKey == true ) && ( evt.shiftKey == true )) {
 					editor.execCommand( 'mceInsertContent', false, '&emsp;&emsp;' ); // inserts tab
					evt.preventDefault();
					evt.stopImmediatePropagation();
					evt.stopPropagation();
					return false;
				}
			}
			return true;
		});
    };


    function Plugin () {
		pluginManager.add('wikinonbreaking', function (editor) {
			registerCommands( editor );
			registerButtons( editor );
			setup( editor );
		});
	}

    Plugin();

}());
