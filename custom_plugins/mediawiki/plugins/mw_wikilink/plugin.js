/**
 * mw-link plugin
 *
 * This pluging creates and displays a dialog for editing internal and external
 * links in the content of the editor
 *
 * Copyright (c) Aoxomoxoa Limited. All rights reserved.
 * Author: Duncan Crane, duncan.crane@aoxomoxoa.co.uk
 * Licensed under the LGPL or a commercial license.
 * For LGPL see License.txt in the project root for license information.
 *
 * Version: 1.0.0 (2020-05-30)
 */
var wikilink = function (editor) {

    'use strict';

    var pluginManager = tinymce.util.Tools.resolve('tinymce.PluginManager');

	var editor = tinymce.activeEditor;
	
	var allow_external_targets = editor.getParam("link_allow_external_targets");
	
	var utility = editor.getParam("wiki_utility");
	
	var setContent = utility.setContent;

	var setSelection = utility.setSelection;

	var getContent = utility.getContent;

	var getSelection = utility.getSelection;

	var htmlDecode = utility.htmlDecode;

	var translate = utility.translate;
	
	var toggleEnabledState = utility.toggleEnabledState;

	var unlink = function ( editor ) {
		var selectedNode = editor.selection.getNode(),
			selectors = ["mwt-internallink", "mwt-externallink"],
			args = {format: 'wiki', load: 'true', convert2html: false};

		while (selectedNode.parentNode != null) {
			if (typeof selectedNode.className != "undefined") {
				for (var selector in selectors) {
					if (selectedNode.className.indexOf( selectors[ selector ]) > -1) {
						setSelection(editor, selectedNode.attributes["data-mwt-wikitext"].value.replace(/\[/m,"&lsqb;"), args);
						return;
					}
				}
			}
			selectedNode = selectedNode.parentNode;
		}
	};

	var open = function ( editor ) {
		var selectedNode = editor.selection.getNode(),
			dataType = '',
			isWikiLink = '',
			linkParts = [],
			value = '',
			aClass = '',
			aLink = '',
			aLabel = '',
			aTrail = '',
			dialogItems,
			initialData;

			if ( !allow_external_targets ) {
				dataType = "internallink";
			}
			
			if (typeof(selectedNode.attributes["data-mwt-type"]) !== "undefined" ) {
			aClass = selectedNode.attributes["class"].value;
			dataType = selectedNode.attributes["data-mwt-type"].value;
			isWikiLink = 
				dataType == "internallink" || 
				dataType == "externallink" ;	
		}

		if (isWikiLink) {
			value = htmlDecode (selectedNode.attributes["data-mwt-wikitext"].value);
			if (dataType == 'internallink') {
				value = value.replace(/^\[\[(.*?)\]\](\w*)/, function (match, $1, $2) {
					// $1 = content of the link
					// $2 = link trail value)

					linkParts = $1.split("|");
					aLink = linkParts[0];
					if (linkParts.length > 1) {
						aLabel = linkParts[1];
					} else {
						aLabel = '';
					}
					if ($2) {
						aTrail = $2;
					} else {
						aTrail = '';
					}
					return match;
				});
			} else if (dataType == 'externallink') {
				value = value.replace(/^\[(.*?)\](\w*)/, function (match, $1, $2) {
					// $1 = content of the link
					// $2 = link trail value)
					
					linkParts = $1.split(" ");
					aLink = linkParts[0];
					if (linkParts.length > 1) {
						aLabel = linkParts.slice( 1 ).join(" ");
					} else {
						aLabel = '';
					}
					if ($2) {
						aTrail = $2;
					} else {
						aTrail = '';
					}
					return match;
				});
			}
		} else {
			aLabel = getSelection( editor, {format : 'raw', convert2wiki : true});
		}

		var initialData = {
//1125			class: aClass,
			class: dataType,
			href: aLink,
			text: aLabel,
			trail: aTrail
		};

		var dialogBody = function ( initialData ) {


			// for inputing the type of link, internal or external
			var classListCtrl = {
				name: 'class',
				type: 'selectbox',
				label: translate("tinymce-link-type-label"),
				hidden: true,
				items: [
//					{text: translate("tinymce-link-type-external"), value: 'mwt-nonEditable mwt-wikiMagic mwt-externallink'},
					{text: translate("tinymce-link-type-external"), value: 'externallink'},
//					{text: translate("tinymce-link-type-internal"), value: 'mwt-nonEditable mwt-wikiMagic mwt-internallink'},
					{text: translate("tinymce-link-type-internal"), value: 'internallink'},
				]
			}
	
			// for inputing the target location of the link
			var linkCtrl = {
				name: 'href',
				type: 'input',
				label: translate("tinymce-link-url-page-label"),
				inputMode: 'text',
				maximized: true,
			};
	
			// for inputing any alternative text for the link which is displayed on the page
			var labelCtrl = {
				name: 'text',
				type: 'input',
				label: translate("tinymce-link-display-text-label"),
				inputMode: 'text',
				maximized: true,
			};
	
			// for updating any link trails (see https://www.mediawiki.org/wiki/Help:Links)for the link
			var trailCtrl = {
				name: 'trail',
				type: 'input',
				label: translate(	"tinymce-link-link-trail-label"),
				inputMode: 'text',
				maximized: true,
			};
			
			if ( allow_external_targets ) {
				var initialDialogItems = [
					classListCtrl,
					linkCtrl,
					labelCtrl
				];

				var linkTrailDialogItems = [
					classListCtrl,
					linkCtrl,
					labelCtrl,
					trailCtrl
				];
			} else {
				var initialDialogItems = [
//					classListCtrl,
					linkCtrl,
					labelCtrl
				];

				var linkTrailDialogItems = [
					classListCtrl,
					linkCtrl,
					labelCtrl,
					trailCtrl
				];
			}
	
			if ( initialData.trail ) {
				dialogItems = linkTrailDialogItems;
			} else {
				dialogItems = initialDialogItems;
			}

			return {
				type: 'panel', 
				items: dialogItems
			};
		};

		var dialogButtons = [
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
		];

		var dialogChange = function( api, changed ) {
		};

		var dialogSubmit = function (api) {
			var href = '',
				hasUrl = false,
				urlProtocolMatch,
				newData = '';

			// Delay confirm since onSubmit will move focus
			function delayedConfirm(message, callback) {
				var rng = editor.selection.getRng();

				tinymce.util.Delay.setEditorTimeout(editor, function() {
					editor.windowManager.confirm(message, function(state) {
						editor.selection.setRng(rng);
						callback(state);
					});
				});
			}

			function insertLink(data) {
				//Trim left and right everything (including linebreaks) that is not a starting or ending link code
				//This is necessary to avoid the wikicode parser from breaking the markup
				var href,
					aLink,
					aLabel,
					aTrail,
					wikitext = '',
					args;

				//first layer of '[...]' //external-, file- and mailto- links
				href = data.href.replace(/(^.*?\[|\].*?$|\r\n|\r|\n)/gm, ''); 
				
				//potential second layer of '[[...]]' //internal and interwiki links
				href = href.replace(/(^.*?\[|\].*?$|\r\n|\r|\n)/gm, ''); 
				aLink = href;
				aLabel = htmlDecode(data.text).replace("_"," ");

				if (data.trail) {
					aTrail = data.trail;
				} else {
					aTrail = '';
				}
			
//1125				} else if (data["class"].indexOf("mwt-externallink") > -1) {
				if ( data["class"] == "externallink" ){ 
					if (aLabel) {
						wikitext = "[" + aLink + " " + aLabel + "]" + aTrail;
					} else {
						wikitext = "[" + aLink + "]" + aTrail;
					}
				} else {
//1125				if (data["class"].indexOf("mwt-internallink") > -1){ 
//1129				if ( data["class"] == "internallink" ){ 
						aLink = aLink.replace("_"," ");
					if (aLabel) {
						wikitext = "[[" + aLink + "|" + aLabel + "]]" + aTrail;
					} else {
						wikitext = "[[" + aLink + "]]" + aTrail;			
					}
				}
				args = {format: 'wiki', mode: 'inline', convert2html: true};
				setSelection( editor, wikitext, args );
//				editor.focus( );
//				editor.insertContent(wikitext, args );
//				editor.nodeChanged();	
			}

			newData = api.getData();
			href = newData.href;

			// if no href is specified then unlink the link
			if (!href) {
				editor.execCommand('wikiunlink');
			}

			// Is email and not //user@domain.com
			if (href.indexOf('@') > 0 && href.indexOf('//') == -1 && href.indexOf('mailto:') == -1) {
				delayedConfirm(
					translate("tinymce-link-want-to-link-email"),
					function(state) {
						if (state) {
							newData.href = 'mailto:' + newData.href;
						}
						insertLink( newData );
					}
				);
				return;
			}

			// Is not protocol prefixed
			urlProtocolMatch = "/^" + mw.config.get( 'wgUrlProtocols' ) + "/i";
			urlProtocolMatch = urlProtocolMatch.replace(/\|/g,"|^");
			if (href.match(urlProtocolMatch) ||
				href.substr(0,2) === "//" ) {
				hasUrl = true;
			}
			
//1125			if ((newData["class"].indexOf("mwt-externallink") > -1) &&
			if (( newData["class"] == "externallink" ) && 
				(editor.settings.link_assume_external_targets && !hasUrl)) {
				delayedConfirm( translate("tinymce-link-want-to-link-external" ), function(state) {
					if (state) {
						newData.href = '//' + encodeURI(newData.href);
						api.close();
						insertLink( newData );
					}
				});
				api.close();
				return;
			}

			api.close();
			insertLink( newData );
		};
		
		editor.windowManager.open({
			title: translate('tinymce-link-title'),
			size: 'normal',
			body: dialogBody ( initialData ),
			buttons: dialogButtons,
			initialData: initialData,
			onChange: dialogChange,
			onSubmit: dialogSubmit,
		});
	}

	var registerCommands = function ( editor ) {
		editor.addCommand('wikilink', function () {
			open( editor );
		});
		editor.addCommand('wikiunlink', function () {
			unlink( editor );
		});
	};
	
	var registerKeys = function ( editor ) {
		editor.ui.registry.addButton( 'wikilink', {
			icon: 'link',
			tooltip: translate("tinymce-link-link-button-tooltip"),
			shortcut: 'Meta+K',
			onAction: function () {
				return open( editor );
			},
		});
		editor.ui.registry.addMenuItem( 'wikilink', {
			icon: 'link',
			text: translate('tinymce-link'),
			tooltip: translate("tinymce-link-link-button-tooltip"),
			context: 'insert',
			onAction: function () {
				return open( editor );
			}
		});
		editor.ui.registry.addToggleButton('wikiunlink', {
			icon: 'unlink',
			onAction: function () {
				return unlink( editor );
			},
			onSetup: toggleEnabledState(editor, ["mwt-internallink", "mwt-externallink"], true)
		});
		editor.shortcuts.add('Meta+' + 219, 'open link dialog', function () {
			open( editor );
		});
		editor.shortcuts.add('Meta+' + 221, 'open link dialog', function () {
			open( editor );
		});
		editor.shortcuts.add('Meta+K', '', function () {
				open( editor );
		});
	};

	this.init = function(editor) {
		registerCommands ( editor );
		registerKeys ( editor );
	}
};

tinymce.PluginManager.add('wikilink', wikilink);
