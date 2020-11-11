/**
 * Copyright (c) Aoxomoxoa Limited, Inc. All rights reserved.
 * Licensed under the LGPL.
 * For LGPL see License.txt in the project root for license information.
 *
 * mw_wikinonrenderinglinebreak plugin
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

	var insertNrlb = function (editor, times) {
		var args = {format: 'html', convert2html: false},
			showPlaceholders = editor.getParam("showPlaceholders"),
			placeholderClass = showPlaceholders ? "mwt-showPlaceholder" : "mwt-hidePlaceholder",
			slb = 
				'<span class="mwt-placeHolder mwt-singleLinebreak mwt-slb' 
				+ (editor.getParam("directionality")) + ' ' + placeholderClass 
				+ '" title="'
				+ translate('tinymce-wikicode-non-rendering-single-linebreak' )
				+ '" data-mwt-wikitext = "\n"'
				+ '" dragable="true" contenteditable="false">' + '&nbsp;'
				+ '</span>';

		setSelection( editor, slb, args );
  
    };

	var registerCommands = function (editor) {
		editor.addCommand('mw_nonrenderinglinebreak', function () {
			insertNrlb(editor, 1);
		});
	};

	var registerButtons = function (editor) {
		var slbIcon = 'slb' + (editor.getParam("directionality"));
		editor.ui.registry.addButton('singlelinebreak', {
			icon: slbIcon,
			tooltip: translate("tinymce-insert-linebreak"),
			onAction: function () {
				return editor.execCommand('mw_nonrenderinglinebreak');
			}
		});
		editor.ui.registry.addMenuItem('singlelinebreak', {
			icon: slbIcon,
			text: translate('tinymce-wikicode-non-rendering-single-linebreak') ,
			tooltip: translate("tinymce-insert-linebreak"),
			context: 'insert',
			onAction: function () {
				return editor.execCommand('mw_nonrenderinglinebreak');
			}
		});
	};

    var setup = function (editor) {
		editor.on('keydown', function (evt) {
			if ( evt.keyCode == 13 ) {
				var html,
					args,
					element,
					outerHTML;
				if (( evt.ctrlKey == true ) && ( evt.shiftKey == true )) {
					editor.execCommand('mwt-nonrenderinglinebreak');
				}
				return true;
			}
		});
    };


    function Plugin () {
		pluginManager.add('wikinonrenderinglinebreak', function (editor) {
			registerCommands( editor );
			registerButtons( editor );
			setup( editor );
		});
	}

    Plugin();

}());
