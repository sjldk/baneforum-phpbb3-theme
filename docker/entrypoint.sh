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

# Template and style changes need a cleared cache.
php bin/phpbbcli.php cache:purge >/dev/null 2>&1 || true
chown -R www-data:www-data cache store files images

exec docker-php-entrypoint "$@"
