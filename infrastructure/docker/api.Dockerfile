# Go3net Office API — PHP 8.4 FPM
FROM php:8.4-fpm-alpine AS base

RUN apk add --no-cache postgresql-dev icu-dev libzip-dev oniguruma-dev \
    && docker-php-ext-install pdo_pgsql intl zip bcmath pcntl opcache

RUN { \
      echo "opcache.enable=1"; \
      echo "opcache.jit=tracing"; \
      echo "opcache.jit_buffer_size=64M"; \
      echo "opcache.validate_timestamps=0"; \
    } > /usr/local/etc/php/conf.d/opcache.ini

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

WORKDIR /var/www/html

COPY apps/api/composer.json apps/api/composer.lock ./
RUN composer install --no-dev --no-autoloader --no-scripts --prefer-dist

COPY apps/api/ ./
RUN composer dump-autoload --optimize --no-dev \
    && chown -R www-data:www-data storage bootstrap/cache

USER www-data
EXPOSE 9000
CMD ["php-fpm"]

# Worker image: same code, runs Horizon-ready queue workers
FROM base AS worker
CMD ["php", "artisan", "queue:work", "--tries=3", "--max-time=3600"]

# Scheduler image
FROM base AS scheduler
CMD ["sh", "-c", "while true; do php artisan schedule:run --verbose --no-interaction; sleep 60; done"]
