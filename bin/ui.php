#!/usr/bin/env php
<?php

declare(strict_types=1);

$host = '127.0.0.1';
$port = 8787;

foreach (array_slice($argv, 1) as $argument) {
    if (str_starts_with($argument, '--host=')) {
        $host = substr($argument, 7);
    }
    if (str_starts_with($argument, '--port=')) {
        $port = (int) substr($argument, 7);
    }
}

if (!in_array($host, ['127.0.0.1', '0.0.0.0'], true)) {
    fwrite(STDERR, "Host must be 127.0.0.1 or 0.0.0.0.\n");
    exit(1);
}

if ($port < 1024 || $port > 65535) {
    fwrite(STDERR, "Port must be between 1024 and 65535.\n");
    exit(1);
}

$router = __DIR__ . '/ui-router.php';
$command = escapeshellarg(PHP_BINARY) . ' -S ' . $host . ':' . $port . ' ' . escapeshellarg($router);

fwrite(STDOUT, "GOG Vault is ready at http://{$host}:{$port}\n");
fwrite(STDOUT, "Press Ctrl+C to stop it.\n\n");
passthru($command, $exitCode);
exit($exitCode);
