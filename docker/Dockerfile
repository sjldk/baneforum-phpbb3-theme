ARG PHP_VERSION=8.5
FROM php:${PHP_VERSION}-apache

ARG PHPBB_VERSION=3.3.19
ARG MARKDOWN_VERSION=1.5.0
ARG MEDIAEMBED_VERSION=2.1.0

RUN apt-get update \
 && apt-get install -y --no-install-recommends unzip libpng-dev libjpeg-dev libfreetype-dev libzip-dev mariadb-client \
 && docker-php-ext-configure gd --with-freetype --with-jpeg \
 && docker-php-ext-install gd mysqli zip \
 && a2enmod rewrite \
 && rm -rf /var/lib/apt/lists/*

RUN curl -fsSL -o /tmp/phpbb.zip "https://download.phpbb.com/pub/release/3.3/${PHPBB_VERSION}/phpBB-${PHPBB_VERSION}.zip" \
 && unzip -q /tmp/phpbb.zip -d /tmp \
 && cp -a /tmp/phpBB3/. /var/www/html/ \
 && rm -rf /tmp/phpbb.zip /tmp/phpBB3 \
 && chown -R www-data:www-data /var/www/html

# Same Markdown extension as production (alfredoramos/markdown, Litedown)
RUN mkdir -p /var/www/html/ext/alfredoramos/markdown \
 && curl -fsSL "https://github.com/AlfredoRamos/phpbb-ext-markdown/archive/refs/tags/${MARKDOWN_VERSION}.tar.gz" \
    | tar xz -C /var/www/html/ext/alfredoramos/markdown --strip-components=1 \
 && chown -R www-data:www-data /var/www/html/ext

# Same media extension as production (phpbb/mediaembed): [media], [youtube] and bare links
RUN mkdir -p /var/www/html/ext/phpbb/mediaembed \
 && curl -fsSL "https://github.com/phpbb-extensions/mediaembed/archive/refs/tags/${MEDIAEMBED_VERSION}.tar.gz" \
    | tar xz -C /var/www/html/ext/phpbb/mediaembed --strip-components=1 \
 && chown -R www-data:www-data /var/www/html/ext

COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh
ENTRYPOINT ["entrypoint.sh"]
CMD ["apache2-foreground"]
