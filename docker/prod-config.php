<?php
// Config for the production copy board (docker-compose.prod.yml). Test database only.
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
