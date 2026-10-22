#!/bin/bash
# Makes (or resets) phpbb_try: a copy of phpbb_prod set up for the production copy board on port 8081.
# Founder login on that board: Baneforum.dk / adminadmin. Needs the main board's db container to run.
set -euo pipefail

db=(docker exec -i docker-db-1 mariadb -uroot -proot)
"${db[@]}" -e 'DROP DATABASE IF EXISTS phpbb_try; CREATE DATABASE phpbb_try CHARACTER SET utf8mb4; GRANT ALL ON phpbb_try.* TO phpbb@"%"'
docker exec docker-db-1 mariadb-dump -uroot -proot --single-transaction phpbb_prod | "${db[@]}" phpbb_try

hash="$(docker exec docker-web-1 php -r 'echo password_hash("adminadmin", PASSWORD_BCRYPT);')"
"${db[@]}" phpbb_try -e "
	UPDATE phpbb_config SET config_value='localhost' WHERE config_name IN ('server_name');
	UPDATE phpbb_config SET config_value='8081' WHERE config_name='server_port';
	UPDATE phpbb_config SET config_value='' WHERE config_name='cookie_domain';
	UPDATE phpbb_config SET config_value='0' WHERE config_name IN ('cookie_secure', 'max_filesize', 'max_filesize_pm', 'img_max_width', 'img_max_height', 'email_enable', 'smtp_delivery');
	UPDATE phpbb_config SET config_value='1' WHERE config_name='force_server_vars';
	UPDATE phpbb_config SET config_value='40' WHERE config_name='max_attachments';
	UPDATE phpbb_extension_groups SET allow_group=1 WHERE group_name IN ('IMAGES', 'ARCHIVES', 'DOCUMENTS', 'DOWNLOADABLE_FILES');
	UPDATE phpbb_users SET user_password='$hash', user_login_attempts=0 WHERE user_id=2;"
"${db[@]}" phpbb_try -N -e "SELECT username FROM phpbb_users WHERE user_id=2"
