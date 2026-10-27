<?php
/**
 * Baneforum login error, da
 *
 * @license GNU General Public License, version 2 (GPL-2.0-only)
 */

if (!defined('IN_PHPBB'))
{
	exit;
}

if (empty($lang) || !is_array($lang))
{
	$lang = [];
}

// phpBB has one text for each case. Both get the same words.
$lang = array_merge($lang, [
	'LOGIN_ERROR_PASSWORD' => 'Brugernavnet eller adgangskoden er forkert. Kontroller begge, og prøv igen. Hvis du fortsat har problemer, kontakt venligst %sboardadministrator%s.',
	'LOGIN_ERROR_USERNAME' => 'Brugernavnet eller adgangskoden er forkert. Kontroller begge, og prøv igen. Hvis du fortsat har problemer, kontakt venligst %sboardadministrator%s.',
]);
