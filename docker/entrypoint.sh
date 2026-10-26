#!/usr/bin/env bash
# Installs phpBB on first start, registers the baneforum theme and makes it the default.
set -euo pipefail

cd /var/www/html
DB=(mysql -h db -u phpbb -pphpbb --skip-ssl phpbb)

until "${DB[@]}" -e 'SELECT 1' >/dev/null 2>&1; do
	echo "Waiting for database..."
	sleep 2
done

if [ ! -s config.php ]; then
	# A new container has no config.php, but the database may still hold the tables of an earlier one,
	# and the installer stops on them. This board is for tests only, so start from an empty database.
	"${DB[@]}" -N -e "SELECT CONCAT('DROP TABLE IF EXISTS \`', table_name, '\`;') FROM information_schema.tables WHERE table_schema='phpbb'" \
		| (echo 'SET FOREIGN_KEY_CHECKS=0;'; cat) | "${DB[@]}"
	echo "Installing phpBB..."
	cat > /tmp/install-config.yml <<YML
installer:
    admin:
        name: admin
        password: adminadmin
        email: admin@example.com
    board:
        lang: en
        name: Baneforum test
        description: Theme test board
    database:
        dbms: mysqli
        dbhost: db
        dbport: 3306
        dbuser: phpbb
        dbpasswd: phpbb
        dbname: phpbb
        table_prefix: phpbb_
    email:
        enabled: false
    server:
        cookie_secure: false
        server_protocol: http://
        force_server_vars: false
        server_name: localhost
        server_port: ${HTTP_PORT:-8080}
        script_path: /
YML
	php install/phpbbcli.php install /tmp/install-config.yml
	rm -rf install
	# Skip styles/baneforum: it is a bind mount owned by the host user.
	find /var/www/html -path /var/www/html/styles/baneforum -prune -o -exec chown www-data:www-data {} +
fi

# Register the theme (mounted at styles/baneforum) once, as a child of prosilver.
if [ "$("${DB[@]}" -N -e "SELECT COUNT(*) FROM phpbb_styles WHERE style_path='baneforum'")" = 0 ]; then
	"${DB[@]}" -e "
		INSERT INTO phpbb_styles (style_name, style_copyright, style_active, style_path, bbcode_bitfield, style_parent_id, style_parent_tree)
		SELECT 'baneforumblue', '© phpBB Limited, 2007', 1, 'baneforum', bbcode_bitfield, style_id, 'prosilver' FROM phpbb_styles WHERE style_path='prosilver';
		UPDATE phpbb_config SET config_value=(SELECT style_id FROM phpbb_styles WHERE style_path='baneforum') WHERE config_name='default_style';
		UPDATE phpbb_users SET user_style=(SELECT style_id FROM phpbb_styles WHERE style_path='baneforum');"
fi

# Enable the Markdown extension (same as production) once.
if [ "$("${DB[@]}" -N -e "SELECT COUNT(*) FROM phpbb_ext WHERE ext_name='alfredoramos/markdown' AND ext_active=1")" = 0 ]; then
	php bin/phpbbcli.php extension:enable alfredoramos/markdown
fi

# Enable the media extension (same as production) once.
if [ "$("${DB[@]}" -N -e "SELECT COUNT(*) FROM phpbb_ext WHERE ext_name='phpbb/mediaembed' AND ext_active=1")" = 0 ]; then
	php bin/phpbbcli.php extension:enable phpbb/mediaembed
fi

# Our own extension that makes uploaded pictures smaller on the server (mounted at ext/baneforum).
if [ "$("${DB[@]}" -N -e "SELECT COUNT(*) FROM phpbb_ext WHERE ext_name='baneforum/imagecompress' AND ext_active=1")" = 0 ]; then
	php bin/phpbbcli.php extension:enable baneforum/imagecompress
fi

# Our own like and dislike buttons.
if [ "$("${DB[@]}" -N -e "SELECT COUNT(*) FROM phpbb_ext WHERE ext_name='baneforum/likes' AND ext_active=1")" = 0 ]; then
	php bin/phpbbcli.php extension:enable baneforum/likes
fi

# Our own front page block with highlighted posts that have pictures.
if [ "$("${DB[@]}" -N -e "SELECT COUNT(*) FROM phpbb_ext WHERE ext_name='baneforum/featured' AND ext_active=1")" = 0 ]; then
	php bin/phpbbcli.php extension:enable baneforum/featured
fi

# Our own list of the latest posts for the front page.
if [ "$("${DB[@]}" -N -e "SELECT COUNT(*) FROM phpbb_ext WHERE ext_name='baneforum/latest' AND ext_active=1")" = 0 ]; then
	php bin/phpbbcli.php extension:enable baneforum/latest
fi

# Our own sort and display button at the top of a topic.
if [ "$("${DB[@]}" -N -e "SELECT COUNT(*) FROM phpbb_ext WHERE ext_name='baneforum/topicsort' AND ext_active=1")" = 0 ]; then
	php bin/phpbbcli.php extension:enable baneforum/topicsort
fi

# Our own contact buttons (message, website) beside the author of a post.
if [ "$("${DB[@]}" -N -e "SELECT COUNT(*) FROM phpbb_ext WHERE ext_name='baneforum/contact' AND ext_active=1")" = 0 ]; then
	php bin/phpbbcli.php extension:enable baneforum/contact
fi

# Our own YouTube thumbnails for the video cards in posts.
if [ "$("${DB[@]}" -N -e "SELECT COUNT(*) FROM phpbb_ext WHERE ext_name='baneforum/ytthumb' AND ext_active=1")" = 0 ]; then
	php bin/phpbbcli.php extension:enable baneforum/ytthumb
fi

# Our own forum menu in the navigation bar.
if [ "$("${DB[@]}" -N -e "SELECT COUNT(*) FROM phpbb_ext WHERE ext_name='baneforum/forummenu' AND ext_active=1")" = 0 ]; then
	php bin/phpbbcli.php extension:enable baneforum/forummenu
fi

# Our own letter avatars for members without an avatar.
if [ "$("${DB[@]}" -N -e "SELECT COUNT(*) FROM phpbb_ext WHERE ext_name='baneforum/avatars' AND ext_active=1")" = 0 ]; then
	php bin/phpbbcli.php extension:enable baneforum/avatars
fi

# Our own switch for the dark theme.
if [ "$("${DB[@]}" -N -e "SELECT COUNT(*) FROM phpbb_ext WHERE ext_name='baneforum/darkmode' AND ext_active=1")" = 0 ]; then
	php bin/phpbbcli.php extension:enable baneforum/darkmode
fi

# Our own word censor. It leaves URLs alone (phpBB's own censor changes addresses and breaks links).
if [ "$("${DB[@]}" -N -e "SELECT COUNT(*) FROM phpbb_ext WHERE ext_name='baneforum/censor' AND ext_active=1")" = 0 ]; then
	php bin/phpbbcli.php extension:enable baneforum/censor
fi

# Attachment settings for the test board: no size limit and no pixel limit of phpBB's own (its default
# is 256 KB, which stops every photo, and it refuses big pictures before an extension can act),
# up to 40 files. The extension above makes the pictures smaller. Thumbnails are made as on production
# (400 px wide, for every picture).
"${DB[@]}" -e "
	UPDATE phpbb_config SET config_value='0' WHERE config_name IN ('max_filesize', 'max_filesize_pm');
	UPDATE phpbb_config SET config_value='0' WHERE config_name='img_max_width';
	UPDATE phpbb_config SET config_value='0' WHERE config_name='img_max_height';
	UPDATE phpbb_config SET config_value='40' WHERE config_name='max_attachments';
	UPDATE phpbb_config SET config_value='1' WHERE config_name='img_create_thumbnail';
	UPDATE phpbb_config SET config_value='400' WHERE config_name='img_max_thumb_width';
	UPDATE phpbb_config SET config_value='1' WHERE config_name='img_min_thumb_filesize';
	UPDATE phpbb_extension_groups SET allow_group=1 WHERE group_name IN ('IMAGES', 'ARCHIVES', 'DOCUMENTS', 'DOWNLOADABLE_FILES');"

# Template and style changes need a cleared cache.
php bin/phpbbcli.php cache:purge >/dev/null 2>&1 || true
chown -R www-data:www-data cache store files images

exec docker-php-entrypoint "$@"
