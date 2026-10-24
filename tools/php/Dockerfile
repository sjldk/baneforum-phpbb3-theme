# The image that runs everything PHP in this repo (lint, code standard, extension tests), as scripts/php-check.sh
# does. Same PHP version as the board (docker/Dockerfile) and the same GD extension, so the tests for the picture
# compressor can run. The host needs no PHP.
ARG PHP_VERSION=8.5
FROM php:${PHP_VERSION}-cli

RUN apt-get update \
 && apt-get install -y --no-install-recommends unzip git libpng-dev libjpeg-dev libfreetype-dev \
 && docker-php-ext-configure gd --with-freetype --with-jpeg \
 && docker-php-ext-install gd \
 && rm -rf /var/lib/apt/lists/*

COPY --from=composer:2 /usr/bin/composer /usr/local/bin/composer
