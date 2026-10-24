<?php
/**
 * Config for the production copy board (docker-compose.prod.yml)
 *
 * It points at the test database only.
 *
 * @license GNU General Public License, version 2 (GPL-2.0-only)
 */

$dbms = 'mysqli';
$dbhost = 'db';
$dbport = '';
$dbname = 'phpbb_try';
$dbuser = 'phpbb';
$dbpasswd = 'phpbb';
$table_prefix = 'phpbb_';
$acm_type = 'file';
$load_extensions = '';

@define('PHPBB_INSTALLED', true);
