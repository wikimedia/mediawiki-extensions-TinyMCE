/**
 * mw-toggle plugin
 *
 * This pluging toggles the visible placeholders for invisible
 * wiki text elements on and off
 *
 * Copyright (c) Aoxomoxoa Limited. All rights reserved.
 * Author: Duncan Crane, duncan.crane@aoxomoxoa.co.uk
 * Licensed under the LGPL or a commercial license.
 * For LGPL see License.txt in the project root for license information.
 *
 * Version: 1.0.0 (2020-05-30)
 */
var wikitoggle = function (editor) {

	'use strict';

	var editor = tinymce.activeEditor;
	
	var utility = editor.getParam("wiki_utility");

	var setSelection = utility.setSelection;

	var translate = utility.translate;
	
	var toggle = function ( editor ) {
		var selectedNode = editor.selection.getNode(), 
			showPlaceholders = editor.getParam("showPlaceholders");

		editor.settings.showPlaceholders = !showPlaceholders;

		var test =	editor.dom.select('.mwt-placeHolder').forEach( function(a) {
				$(a).toggleClass( "mwt-showPlaceholder", !showPlaceholders );
				$(a).toggleClass( "mwt-hidePlaceholder", showPlaceholders );
			});
	};

	var registerCommands = function ( editor ) {
		editor.addCommand('wikiPlacehodlerToggle', function () {
			toggle( editor );
		});
	};

	var registerButtons = function ( editor ) {
		editor.ui.registry.addToggleButton('wikitoggle', {
			tooltip: translate("tinymce-toggle-button-toggle-wiki-placeholders"),
			icon: 'visualchars',
			onAction: function () {
				return toggle( editor );
			},
      	});
		editor.ui.registry.addToggleMenuItem('wikitoggle', {
			text: translate("tinymce-toggle-button-toggle-wiki-placeholders"),
			icon: 'visualchars',
			onAction: function () {
				return toggle( editor );
			},
		});
	};

	this.init = function(editor) {
		registerCommands ( editor );
		registerButtons ( editor );
	}
};

tinymce.PluginManager.add('wikitoggle', wikitoggle);

