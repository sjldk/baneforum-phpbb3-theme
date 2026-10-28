<?php
/**
 * Baneforum Facebook data deletion, da
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

$lang = array_merge($lang, [
	'FBDELETION_TITLE'     => 'Slet dine data',
	'FBDELETION_DONE'      => 'Din konto er slettet. Dine indlæg bliver stående, men de vises nu som skrevet af “Gæst”. Dit navn er fjernet fra dem.',
	'FBDELETION_WAITING'   => 'Vi har fået din anmodning, men kontoen er ikke slettet endnu. En administrator gør det. Skriv til forummets administrator, hvis det tager lang tid.',
	'FBDELETION_NOT_FOUND' => 'Denne side findes ikke.',
]);
