<?php

use MediaWiki\MediaWikiServices;
#use MediaWiki\User\UserOptionsManager;

/**
 * Static functions called by various outside hooks, as well as by
 * extension.json.
 *
 * @author Yaron Koren
 * @file
 * @ingroup TinyMCE
 */

class TinyMCEHooks {

	public static function registerExtension() {
		if ( defined( 'TINYMCE_VERSION' ) ) {
			// Do not load this extension more than once.
			return 1;
		}

		define( 'TINYMCE_VERSION', '1.0' );

		$GLOBALS['wgTinyMCEIP'] = dirname( __DIR__ ) . '/../';
		$GLOBALS['wgTinyMCEUse'] = null;

		// We have to have this hook called here, instead of in
		// extension.json, because it's conditional.
		if ( class_exists( 'MediaWiki\Linker\LinkRenderer' ) ) {
			// MW 1.28+
			$GLOBALS['wgHooks']['HtmlPageLinkRendererEnd'][] = 'TinyMCEHooks::changeRedLink';
		} else {
			$GLOBALS['wgHooks']['LinkEnd'][] = 'TinyMCEHooks::changeRedLinkOld';
		}
	}

	/**
	 * Try to translate between MediaWiki's language codes and TinyMCE's -
	 * they're similar, but not identical. MW's are always lowercase, and
	 * they tend to use fewer country codes.
	 */
	static function mwLangToTinyMCELang( $mwLang ) {
		// 'en' gets special handling, because it's TinyMCE's
		// default language - it requires no language add-on.
		if ( $mwLang == null || $mwLang === 'en' ) {
			return 'en';
		}

		$tinyMCELanguages = array(
			'af_ZA',
			'ar', 'ar_SA',
			'az',
			'eu',
			'be',
			'bn_BD',
			'bs',
			'bg_BG',
			'ca',
			'cs', 'cs_CZ',
			'cy',
			'da',
			'de',
			'de_AT',
			'dv',
			'el',
			'en_CA', 'en_GB',
			'eo',
			'es', 'es_AR', 'es_MX',
			'et',
			'eu',
			'fa',
			'fa_IR',
			'fi',
			'fo',
			'fr_FR', 'fr_CH',
			'ga',
			'gd',
			'gl',
			'he_IL',
			'hi_IN',
			'hr',
			'hu_HU',
			'hy',
			'id',
			'is_IS',
			'it',
			'ja',
			'ka_GE',
			'kab',
			'kk',
			'km_KH',
			'ko',
			'ko_KR',
			'ku',
			'ku_IQ',
			'lb',
			'lt',
			'lv',
			'mk_MK',
			'ml', 'ml_IN',
			'mn_MN',
			'nb_NO',
			'nl',
			'pl',
			'pt_BR', 'pt_PT',
			'ro',
			'ru', 'ru_RU', 'ru@petr1708',
			'si_LK',
			'sk',
			'sl_SI',
			'sr',
			'sv_SE',
			'ta', 'ta_IN',
			'tg',
			'th_TH',
			'tr', 'tr_TR',
			'tt',
			'ug',
			'uk', 'uk_UA',
			'uz',
			'vi', 'vi_VN',
			'zh_CN', 'zh_CN.GB2312', 'zh_TW',
		);

		foreach ( $tinyMCELanguages as $tinyMCELang ) {
			if ( $mwLang === strtolower( $tinyMCELang ) ||
				$mwLang === substr( $tinyMCELang, 0, 2 ) ) {
				return $tinyMCELang;
			}
		}

		// If there was no match found, see if there's a matching
		// "fallback language" for the current language - like
		// 'fr' for 'frc'.
		$fallbackLangs = Language::getFallbacksFor( $mwLang );
		foreach ( $fallbackLangs as $fallbackLang ) {
			if ( $fallbackLang === 'en' ) {
				continue;
			}
			foreach ( $tinyMCELanguages as $tinyMCELang ) {
				if ( $fallbackLang === strtolower( $tinyMCELang ) ||
					$fallbackLang === substr( $tinyMCELang, 0, 2 ) ) {
					return $tinyMCELang;
				}
			}
		}

		return 'en';
	}

	static function setGlobalJSVariables( &$vars, $out ) {
		global $wgTinyMCEEnabled, $wgTinyMCETemplates, $wgTinyMCEPreservedTags;
		global $wgCheckFileExtensions, $wgStrictFileExtensions;
		global $wgFileExtensions, $wgFileBlacklist;
		global $wgEnableUploads;
		global $wgTinyMCESettings;
		global $wgWsTinyMCEModals;
		global $wgTinyMCEUse;

		if ( !$wgTinyMCEEnabled ) {
			return true;
		}

		$context = $out->getContext();

		$extensionTags = MediaWikiServices::getInstance()->getParser()->getTags();
		$specialTags = '';
		$preservedTags = '';
		foreach ( $extensionTags as $tagName ) {
			if ( ( $tagName == 'pre' ) || ($tagName == 'nowiki') ) {
				continue;
			}
			$specialTags .= $tagName . '|';
		}

		$defaultTags = array(
			"includeonly", "onlyinclude", "noinclude", "nowiki" //Definitively MediaWiki core
		);

		$tinyMCETagList = $specialTags . implode( '|', $defaultTags );

		$vars['wgTinyMCETagList'] = $tinyMCETagList;

		$mwLanguage = $context->getLanguage()->getCode();
		$tinyMCELanguage = self::mwLangToTinyMCELang( $mwLanguage );
		$vars['wgTinyMCELanguage'] = $tinyMCELanguage;
		$directionality = $context->getLanguage()->getDir();
		$vars['wgTinyMCEDirectionality'] = $directionality;
		$vars['wgCheckFileExtensions'] = $wgCheckFileExtensions;
		$vars['wgStrictFileExtensions'] = $wgStrictFileExtensions;
		$vars['wgFileExtensions'] = $wgFileExtensions;
		$vars['wgFileBlacklist'] = $wgFileBlacklist;
		$vars['wgEnableUploads'] = $wgEnableUploads;
		$vars['wgTinyMCEVersion'] = ExtensionRegistry::getInstance()->getAllThings()['TinyMCE']['version'];

		$user = $context->getUser();

		if ($user->isAllowed('upload')) {
			$userMayUpload = true;
		} else {
			$userMayUpload = false;
		}
		$vars['wgTinyMCEUserMayUpload'] = $userMayUpload;

		if ($user->isAllowed('upload_by_url')) {
			$userMayUploadFromURL = true;
		} else {
			$userMayUploadFromURL= false;
		}
		$vars['wgTinyMCEUserMayUploadFromURL'] = $userMayUploadFromURL;

		if ( $user->getBlock() ) {
			$userIsBlocked = true;
		} else {
			$userIsBlocked = false;
		}
		$vars['wgTinyMCEUserIsBlocked'] = $userIsBlocked ;
 		$vars['wgTinyMCESettings'] = $wgTinyMCESettings;
		$vars['wgWsTinyMCEModals'] = $wgWsTinyMCEModals;


		return true;
	}

	/**
	 * Register magic-word variable IDs
	 */
	static function addMagicWordVariableIDs( &$magicWordVariableIDs ) {
		$magicWordVariableIDs[] = 'MAG_NOTINYMCE';
		return true;
	}

	/**
	 * Set a value in the page_props table based on the presence of the
	 * 'NOTINYMCE' magic word in a page
	 */
	static function handleMagicWords( &$parser, &$text ) {
		if ( class_exists( MagicWordFactory::class ) ) {
			// MW 1.32+
			$factory = MediaWikiServices::getInstance()->getMagicWordFactory();
			$magicWord = $factory->get( 'MAG_NOTINYMCE' );
		} else {
			$magicWord = MagicWord::get( 'MAG_NOTINYMCE' );
		}
		if ( $magicWord->matchAndRemove( $text ) ) {
			$parser->mOutput->setProperty( 'notinymce', 'y' );
		}
		return true;
	}

	/**
	 * Adds an "edit" link for TinyMCE, and renames the current "edit"
	 * link to "edit source", for all sections on the page, if it's
	 * editable with TinyMCE in the first place.
	 */
	public static function addEditSectionLink( $skin, $title, $section, $tooltip, &$links, $lang ) {
		global $wgTinyMCEUse;
		$context = $skin->getContext();
		$user = $context->getUser();
		
		$wgTinyMCEUse =  TinyMCEHooks::enableTinyMCE( $title, $context );

/*		if ( method_exists( 'MediaWiki\Permissions\PermissionManager', 'userCan' ) ) {
			// MW 1.33+
			$permissionManager = MediaWikiServices::getInstance()->getPermissionManager();
			$userCanEdit = $permissionManager->userCan( 'edit', $user, $title );
		} else {
			$userCanEdit = $title->userCan( 'edit', $user ) && $user->isAllowed( 'edit' );
		}

		if ( !isset( $title ) || !$userCanEdit ) {
			return true;
		}*/

		if ( !$wgTinyMCEUse ) {
			return true;
		}

		foreach ( $links as &$link ) {
			if ( $link['query']['action'] == 'edit' ) {
				$newLink = $link;
				$link['text'] = ' | ' . $skin->msg( 'tinymce-editsectionsource' )->text() ;
			}
		}
		$newLink['query']['action'] = 'tinymceedit';
		$links = array_merge( array( 'tinymceeditsection' => $newLink ), $links );

		return true;
	}

	/**
	 * Sets broken/red links to point to TinyMCE edit page, if they
	 * haven't been customized already - for MW < 1.28.
	 *
	 * @param Linker $linker
	 * @param Title $target
	 * @param array $options
	 * @param string $text
	 * @param array &$attribs
	 * @param bool &$ret
	 * @return true
	 */
	static function changeRedLinkOld( $linker, $target, $options, $text, &$attribs, &$ret ) {
		global $wgTinyMCEUse;
		global $wgOut;

		// If it's not a broken (red) link, exit.
		if ( !in_array( 'broken', $options, true ) ) {
			return true;
		}
		// If the link is to a special page, exit.
		if ( $target->getNamespace() == NS_SPECIAL ) {
			return true;
		}

		// This link may have been modified already by Page Forms or
		// some other extension - if so, leave it as it is.
		if ( strpos( $attribs['href'], 'action=edit&' ) === false ) {
			return true;
		}

		$exWgTinyMCEUse = $wgTinyMCEUse;
		$context = $wgOut->getContext();
		if ( !TinyMCEHooks::enableTinyMCE( $title, $context ) ) {
			return true;
		}
		$wgTinyMCEUse = $exWgTinyMCEUse;

		$attribs['href'] = $target->getLinkURL( array( 'action' => 'tinymceedit', 'redlink' => '1' ) );

		return true;
	}

	/**
	 * Called by the HtmlPageLinkRendererEnd hook.
	 *
	 * The $target argument is listed in the documentation as being of type
	 * LinkTarget, but in practice it seems to sometimes be of type Title
	 * and sometimes of type TitleValue. So we just leave out a type
	 * declaration for that argument in the declaration.
	 *
	 * @param LinkRenderer $linkRenderer
	 * @param Title $target
	 * @param bool $isKnown
	 * @param string &$text
	 * @param array &$attribs
	 * @param bool &$ret
	 * @return true
	 */
	static function changeRedLink( MediaWiki\Linker\LinkRenderer $linkRenderer, $target, $isKnown, &$text, &$attribs, &$ret ) {
		global $wgTinyMCEUse;
		global $wgTinyMCEDisabledNamespaces;

		// If it's not a broken (red) link, exit.
		if ( $isKnown ) {
			return true;
		}
		// If the link is to a special page, exit.
		if ( $target->getNamespace() == NS_SPECIAL ) {
			return true;
		}

		// This link may have been modified already by Page Forms or
		// some other extension - if so, leave it as it is.
		if ( strpos( $attribs['href'], 'action=edit&' ) === false ) {
			return true;
		}

		if ( $target instanceof Title ) {
			$title = $target;
		} else {
			// TitleValue object in MW >= 1.34?
			$title = Title::newFromLinkTarget( $target );
		}

		// check TinyMCE allowed for namespace
		if ( in_array( $title->getNamespace(), $wgTinyMCEDisabledNamespaces ) ) {
			return true;
		}

		$attribs['href'] = $title->getLinkURL( array( 'action' => 'tinymceedit', 'redlink' => '1' ) );

		return true;
	}

	/**
	 * Is there a less hacky way to do this, like stopping the toolbar
	 * creation before it starts?
	 */
	public static function removeDefaultToolbar( &$toolbar ) {
		global $wgTinyMCEEnabled;
		if ( $wgTinyMCEEnabled ) {
			$toolbar = null;
		}
		return true;
	}

	public static function enableTinyMCE( $title, $context ) {
		global $wgTinyMCEDisabledNamespaces, $wgTinyMCEUnhandledStrings;
		global $wgTinyMCEUse;
		$user = $context->getUser();

		// already checked so save work
		if ( $wgTinyMCEUse !== null) return $wgTinyMCEUse;

		// if the user isn't allowed to edit this page then won't need TinyMCE!
		if ( method_exists( 'MediaWiki\Permissions\PermissionManager', 'userCan' ) ) {
			// MW 1.33+
			$permissionManager = MediaWikiServices::getInstance()->getPermissionManager();
			$userCanEdit = $permissionManager->userCan( 'edit', $user, $title );
		} else {
			$userCanEdit = $title->userCan( 'edit', $user ) && $user->isAllowed( 'edit' );
		}

		if ( !isset( $title ) || !$userCanEdit ) {
			return $wgTinyMCEUse = false;
		}

		if ( in_array( $title->getNamespace(), $wgTinyMCEDisabledNamespaces ) ) {
			return $wgTinyMCEUse = false;
		}

		if ( $context->getRequest()->getCheck( 'undo' ) ) {
			return $wgTinyMCEUse = false;
		}
		if ( !$context->getUser()->getOption( 'tinymce-use' ) ) {
			return $wgTinyMCEUse = false;
		}

		if ( !empty( $wgTinyMCEUnhandledStrings ) ) {
			$wikiPage = new WikiPage( $title );
			$content = $wikiPage->getContent();
			if ( $content != null ) {
				$pageText = $content->getText();
				foreach ( $wgTinyMCEUnhandledStrings as $str ) {
					if ( strpos( $pageText, $str ) !== false ) {
						return $wgTinyMCEUse = false;
					}
				}
			}
		}

		// If there's a 'notinymce' property for this page in the
		// page_props table, regardless of the value, disable TinyMCE.
		$dbr = wfGetDB( DB_REPLICA );
		$res = $dbr->select( 'page_props',
			array(
				'pp_value'
			),
			array(
				'pp_page' => $title->getArticleID(),
				'pp_propname' => 'notinymce'
			)
		);

		// First row of the result set.
		$row = $dbr->fetchRow( $res );
		if ( $row != null ) {
			return $wgTinyMCEUse = false;
		}

		global $wgTinyMCELoadOnView;
		if ( Action::getActionName( $context ) === 'view') {
#		    return (bool)$wgTinyMCELoadOnView;
		}

		return $wgTinyMCEUse = true;
	}

	/**
	 * This code is called separately from addToEditPage() because it needs
	 * to be called earlier - addToEditPage() is called via the same hook
	 * (EditPage::showEditForm:initial) as WikiEditor's code for
	 * determining whether to install WikiEditor - which means that, if
	 * this code were part of addToEditPage(), whether or not it ran
	 * correctly would depend on the order in which the extensions were
	 * called. Instead, for this code we use a hook called earlier -
	 * AlternateEdit.
	 */
	public static function determineIfTinyMCEIsEnabled( EditPage $editPage ) {
		global $wgTinyMCEEnabled;
		global $wgTinyMCEUse;

		$wgTinyMCEEnabled = false;

		$context = $editPage->getArticle()->getContext();

		$action = Action::getActionName( $context );
		if ( $action != 'tinymceedit' ) {
			return true;
		}

		$title = $editPage->getTitle();
		$wgTinyMCEEnabled = self::enableTinyMCE( $title, $context );

		return true;
	}

	public static function addToEditPage( EditPage &$editPage, OutputPage &$output ) {
		global $wgTinyMCEEnabled;

		if ( !$wgTinyMCEEnabled ) {
			return true;
		}

		$output->addModules( 'ext.tinymce' );

		$output->addHTML( Html::rawElement( 'p', null, wfMessage( 'tinymce-notice' )->parse() ) );

		return true;
	}

	public static function disableWikiEditor( $editPage ) {
		global $wgTinyMCEEnabled;

		if ( $wgTinyMCEEnabled ) {
			return false;
		}
		return true;
	}

	/**
	 * Load the extension on every view, if allowed.
	 *
	 * @param OutputPage $output
	 * @return void
	*/
	public static function addToViewPage(  OutputPage $output, ParserOutput $parserOutput ) {
		$context = $output->getContext();
		$action = Action::getActionName( $context );

		if ( $action != 'view' ) {
			return;
		}

		self::enableTinyMCE( $output->getTitle(), $context );
		$GLOBALS['wgTinyMCEEnabled'] = true;
		$output->addModules( 'ext.tinymce' );
/*0422		if (( self::enableTinyMCE( $output->getTitle(), $context ) ) ||
			( substr( $output->getTitle()->getBaseText(), 0, 8 ) == 'FormEdit' )) {
			$GLOBALS['wgTinyMCEEnabled'] = true;
			$output->addModules( 'ext.tinymce' );
		} else {
			$GLOBALS['wgTinyMCEEnabled'] = false;
		}*/
	}

	/**
	 * Add a tag for bracketing in-line editable wiki text.
	 *
	 * @param OutputPage $output
	 * @return void
	*/
	public static function onParserFirstCallInit( Parser $parser ) {

		$parser->setHook( 'editinline', [ self::class, 'renderEditInline' ] );

	}

	public static function renderEditInline( $input, array $args, Parser $parser, PPFrame $frame ) {
		$attr = [];    
		// This time, make a list of attributes and their values, and dump them, along with the user input
		foreach( $args as $name => $value ) {
 			$attr[] = $name . '="' . $value . '"';
		}
		return '<form action="get"><div ' . implode( ' ', $attr ) .  '>' . htmlspecialchars( $input ) . '</div></form>';	
#		return implode( '<br />', $attr ) . "\n\n" . htmlspecialchars( $input );

	/**
	 * The following lines can be used to get the variable values directly:
	 * $to = $args['to'] ;
	 * $email = $args['email'] ;
	 */
	}	

	public static function addPreference( $user, &$preferences ) {
		$preferences['tinymce-use'] = array(
			'type' => 'toggle',
			'label-message' => 'tinymce-preference', // a system message
			'section' => 'editing/advancedediting',
		);

		return true;
	}

	public static function addRLModules( &$otherModules ) {
		$otherModules[] = 'ext.tinymce';
		return true;
	}

}
