<?php

use MediaWiki\MediaWikiServices;

/**
 * Handles the formedit action.
 *
 * @author Yaron Koren
 * @author Stephan Gambke
 * @file
 * @ingroup PF
 */

class TinyMCEAction extends Action {

	/**
	 * Return the name of the action this object responds to
	 * @return String lowercase
	 */
	public function getName() {
		return 'tinymceedit';
	}

	/**
	 * The main action entry point.
	 * @throws ErrorPageError
	 */
	public function show() {
		$title = $this->getTitle();
		$context = $this->getContext();
		$article = Article::newFromTitle( $title, $context );
		$editPage = new EditPage( $article );
		$editPage->setContextTitle( $title );
		// Keep additional screens in this tab, instead of going to 'action=submit'.
		$editPage->action = 'tinymceedit';
		return $editPage->edit();
	}

	/**
	 * Execute the action in a silent fashion: do not display anything or release any errors.
	 * @return Bool whether execution was successful
	 */
	public function execute() {
		return true;
	}

	/**
	 * Adds an "action" (i.e., a tab) to edit the current article with
	 * TinyMCE; and also modifies the "Add topic" link, if we are on a
     * talk page.
	 */
	static function displayTabAndModifyAddTopicLink( $obj, &$links ) {
		global $wgRequest;
		global $wgTinyMCEUse;

		$content_actions = &$links['views'];
		$title = $obj->getTitle();
		$context = $obj->getContext();
		$user = $obj->getUser();

		if ( !isset( $title ) ) {
			return true;
		}

		if (count( $content_actions ) == 0 ){
			return true;
		}

		if ( method_exists( 'MediaWiki\Permissions\PermissionManager', 'userCan' ) ) {
			// MW 1.33+
			$permissionManager = MediaWikiServices::getInstance()->getPermissionManager();
			$userCanEdit = $permissionManager->userCan( 'edit', $user, $title );
		} else {
			$userCanEdit = $title->userCan( 'edit', $user ) && $user->isAllowed( 'edit' );
		}

		if ( !$userCanEdit ) {
			return true;
		}

		if ( !$wgTinyMCEUse ) {
			return true;
		}

		// change red link to the 'talk' page to use TinyMCE
		foreach ($links['namespaces'] as $key => $val) {
			if ($key == 'talk' ) {
				$talkLink = $links['namespaces']['talk']['href'];
				$talkLink = str_replace( 'action=edit', 'action=tinymceedit', $talkLink );
					
				$links['namespaces']['talk']['href'] = $talkLink;
			}
		}

		// if there are no actionss just leave
		if (count( $content_actions ) == 0 ){
			return true;
		}

		// Create the form edit tab, and apply whatever changes are
		// specified by the edit-tab global variables.
		if ( array_key_exists( 'edit', $content_actions ) ) {
			$content_actions['edit']['text'] = wfMessage( 'tinymce-editsource' )->text();
		}

		$class_name = ( $wgRequest->getVal( 'action' ) == 'tinymceedit' ) ? 'selected' : '';
		$tinyMCETab = array(
			'class' => $class_name,
			'text' => wfMessage( 'edit' )->text(),
			'href' => $title->getLocalURL( 'action=tinymceedit' )
		);

		// Find the location of the 'edit' tab, and add 'edit
		// with form' right before it.
		// This is a "key-safe" splice - it preserves both the keys
		// and the values of the array, by editing them separately
		// and then rebuilding the array. Based on the example at
		// http://us2.php.net/manual/en/function.array-splice.php#31234
		$tab_keys = array_keys( $content_actions );
		$tab_values = array_values( $content_actions );
		$edit_tab_location = array_search( 'edit', $tab_keys );

		// If there's no 'edit' tab, look for the 'view source' tab
		// instead.
		if ( $edit_tab_location == null ) {
			$edit_tab_location = array_search( 'viewsource', $tab_keys );
		}

		// This should rarely happen, but if there was no edit *or*
		// view source tab, set the location index to 0, so the
		// tab shows up near the front.
		if ( $edit_tab_location == null ) {
#			$edit_tab_location = - 1;
			$edit_tab_location = 0;
		}
		array_splice( $tab_keys, $edit_tab_location, 0, 'tinymceedit' );
		array_splice( $tab_values, $edit_tab_location, 0, array( $tinyMCETab ) );
		$content_actions = array();
		for ( $i = 0; $i < count( $tab_keys ); $i++ ) {
			$content_actions[$tab_keys[$i]] = $tab_values[$i];
		}

		// If we're on a talk page, also modify the "Add topic" link
		// to use TinyMCE.
		if ( array_key_exists( 'addsection', $content_actions ) ) {
			$curURL = $content_actions['addsection']['href'];
			$content_actions['addsection']['href'] = str_replace( 'action=edit', 'action=tinymceedit', $curURL );
		}

		// Give other extensions a chance to disable TinyMCE for this page.
		if ( !Hooks::run( 'TinyMCEDisable', array( $title ) ) ) {
			unset($links['views']['tinymceedit']);
		}

		return true; // always return true, in order not to stop MW's hook processing!
	}

}
