<?php

declare(strict_types=1);

const UI_COMMANDS = [
    'games' => ['flags' => [], 'values' => []],
    'languages' => ['flags' => [], 'values' => []],
    'code-login' => ['flags' => [], 'values' => ['code']],
    'update' => [
        'flags' => ['new-only', 'updated-only', 'clear', 'include-hidden', 'skip-errors'],
        'values' => ['search', 'os', 'language', 'retry', 'retry-delay', 'idle-timeout'],
    ],
    'download' => [
        'flags' => ['update', 'language-fallback-english', 'extras', 'skip-existing-extras', 'no-games', 'no-patches', 'remove-invalid', 'skip-errors'],
        'values' => ['directory', 'os', 'language', 'only', 'without', 'bandwidth', 'retry', 'retry-delay', 'idle-timeout'],
    ],
    'download-saves' => [
        'flags' => ['update', 'skip-errors'],
        'values' => ['directory', 'os', 'language', 'only', 'without', 'retry', 'retry-delay', 'idle-timeout'],
    ],
    'total-size' => [
        'flags' => ['update', 'language-fallback-english', 'extras', 'no-games', 'no-patches'],
        'values' => ['os', 'language', 'only', 'without'],
    ],
];

$root = dirname(__DIR__);
$public = $root . '/ui';
$path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';

if ($path === '/api/status') {
    $job = getActiveJob($root);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode([
        'ok' => true,
        'php' => PHP_VERSION,
        'appReady' => is_file($root . '/vendor/autoload.php'),
        'platform' => PHP_OS_FAMILY,
        'activeJob' => $job,
        'downloadDirectory' => $_ENV['DOWNLOAD_DIRECTORY'] ?? getcwd(),
        'downloadLabel' => $_ENV['UI_DOWNLOAD_LABEL'] ?? null,
    ], JSON_THROW_ON_ERROR);
    return;
}

if ($path === '/api/log') {
    header('Content-Type: application/json; charset=utf-8');
    $log = $root . '/var/ui-job.log';
    echo json_encode(['log' => is_file($log) ? (string) file_get_contents($log) : ''], JSON_UNESCAPED_UNICODE);
    return;
}

if ($path === '/api/cancel' && ($_SERVER['REQUEST_METHOD'] ?? '') === 'POST') {
    header('Content-Type: application/json; charset=utf-8');
    $job = getActiveJob($root);
    $pid = (int) ($job['pid'] ?? 0);
    if ($pid < 1) {
        http_response_code(409);
        echo json_encode(['ok' => false, 'message' => 'No cancellable job is running.']);
        return;
    }
    if (PHP_OS_FAMILY === 'Windows') {
        exec('taskkill /PID ' . $pid . ' /T /F', $output, $code);
        $stopped = $code === 0;
    } else {
        $stopped = function_exists('posix_kill') ? posix_kill($pid, 15) : false;
        if (!$stopped) {
            exec('kill -TERM ' . $pid, $output, $code);
            $stopped = $code === 0;
        }
    }
    echo json_encode(['ok' => $stopped]);
    return;
}

if ($path === '/api/library') {
    header('Content-Type: application/json; charset=utf-8');
    $database = ($_ENV['CONFIG_DIRECTORY'] ?? $root) . '/gog-downloader.db';
    $games = [];
    if (is_file($database)) {
        $pdo = new PDO('sqlite:' . $database);
        $query = $pdo->query('SELECT g.id, g.game_id, g.title, g.slug,
            COALESCE(SUM(d.size), 0) AS total_size,
            COUNT(d.id) AS file_count,
            GROUP_CONCAT(DISTINCT d.platform) AS platforms,
            (SELECT COUNT(*) FROM game_extras e WHERE e.game_id = g.id) AS extra_count
            FROM games g LEFT JOIN downloads d ON d.game_id = g.id
            GROUP BY g.id ORDER BY g.title COLLATE NOCASE');
        $games = $query === false ? [] : $query->fetchAll(PDO::FETCH_ASSOC);
        $downloadRoot = $_ENV['DOWNLOAD_DIRECTORY'] ?? getcwd();
        foreach ($games as &$game) {
            $folder = $downloadRoot . DIRECTORY_SEPARATOR . ($game['slug'] ?: preg_replace('/[^a-z0-9]+/i', '-', strtolower($game['title'])));
            $game['backed_up'] = is_dir($folder);
            $game['total_size'] = (int) $game['total_size'];
            $game['file_count'] = (int) $game['file_count'];
            $game['extra_count'] = (int) $game['extra_count'];
            $game['platforms'] = array_values(array_filter(explode(',', (string) $game['platforms'])));
        }
        unset($game);
    }
    echo json_encode(['games' => $games], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    return;
}

if ($path === '/api/game') {
    header('Content-Type: application/json; charset=utf-8');
    $id = $_GET['id'] ?? '';
    if (!is_string($id) || !preg_match('/^\d+$/', $id)) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid game id']);
        return;
    }
    $database = ($_ENV['CONFIG_DIRECTORY'] ?? $root) . '/gog-downloader.db';
    if (!is_file($database)) {
        http_response_code(404);
        return;
    }
    $pdo = new PDO('sqlite:' . $database);
    $gameQuery = $pdo->prepare('SELECT id, game_id, title, slug, cd_key FROM games WHERE game_id = ?');
    $gameQuery->execute([$id]);
    $game = $gameQuery->fetch(PDO::FETCH_ASSOC);
    if (!$game) {
        http_response_code(404);
        return;
    }
    $downloads = $pdo->prepare('SELECT name, language, platform, size, is_patch FROM downloads WHERE game_id = ? ORDER BY platform, language, name');
    $downloads->execute([$game['id']]);
    $extras = $pdo->prepare('SELECT name, size FROM game_extras WHERE game_id = ? ORDER BY name');
    $extras->execute([$game['id']]);
    echo json_encode(['game' => $game, 'downloads' => $downloads->fetchAll(PDO::FETCH_ASSOC), 'extras' => $extras->fetchAll(PDO::FETCH_ASSOC)], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    return;
}

if ($path === '/api/artwork') {
    $id = $_GET['id'] ?? '';
    if (!is_string($id) || !preg_match('/^\d+$/', $id)) {
        http_response_code(400);
        return;
    }
    $cacheDir = $root . '/var/artwork';
    if (!is_dir($cacheDir)) {
        mkdir($cacheDir, 0777, true);
    }
    $cache = $cacheDir . '/' . $id . '.jpg';
    if (is_file($cache)) {
        header('Content-Type: image/jpeg');
        header('Cache-Control: public, max-age=2592000');
        readfile($cache);
        return;
    }
    $image = '';
    if ($image === '') {
        $context = stream_context_create(['http' => ['timeout' => 8, 'header' => "User-Agent: GOG Vault\r\n"]]);
        $json = @file_get_contents('https://api.gog.com/products/' . $id . '?locale=en-US', false, $context);
        $product = $json === false ? null : json_decode($json, true);
        $image = $product['images']['background'] ?? '';
        if (str_starts_with($image, '//')) {
            $image = 'https:' . $image;
        }
        if ($image !== '' && str_starts_with($image, 'https://')) {
            $bytes = @file_get_contents($image, false, $context);
            if ($bytes !== false) {
                file_put_contents($cache, $bytes);
                header('Content-Type: image/jpeg');
                header('Cache-Control: public, max-age=2592000');
                echo $bytes;
                return;
            }
        }
    }
    if ($image === '') {
        http_response_code(404);
        return;
    }
    header('Cache-Control: public, max-age=604800');
    header('Location: ' . $image, true, 302);
    return;
}

if ($path === '/api/run' && ($_SERVER['REQUEST_METHOD'] ?? '') === 'POST') {
    runCommand($root);
    return;
}

if ($path === '/') {
    $path = '/index.html';
}

$file = realpath($public . $path);
if ($file === false || !str_starts_with($file, realpath($public)) || !is_file($file)) {
    http_response_code(404);
    echo 'Not found';
    return;
}

$types = ['css' => 'text/css', 'js' => 'text/javascript', 'html' => 'text/html'];
header('Content-Type: ' . ($types[pathinfo($file, PATHINFO_EXTENSION)] ?? 'application/octet-stream') . '; charset=utf-8');
readfile($file);

function runCommand(string $root): void
{
    ignore_user_abort(true);
    if (!is_dir($root . '/var')) {
        mkdir($root . '/var', 0777, true);
    }
    header('Content-Type: application/x-ndjson; charset=utf-8');
    header('Cache-Control: no-cache, no-store');
    header('X-Accel-Buffering: no');

    if (!is_file($root . '/vendor/autoload.php')) {
        emit(['type' => 'error', 'message' => 'Dependencies are missing. Run composer install first.']);
        return;
    }

    try {
        $payload = json_decode(file_get_contents('php://input'), true, flags: JSON_THROW_ON_ERROR);
        $name = is_string($payload['command'] ?? null) ? $payload['command'] : '';
        if (!isset(UI_COMMANDS[$name])) {
            throw new InvalidArgumentException('Unsupported command.');
        }

        // Browser output is a log, not a TTY. ANSI cursor controls make streamed
        // progress bars unreadable when chunks arrive at different boundaries.
        $args = [PHP_BINARY, $root . '/bin/app.php', $name, '--no-interaction', '--no-ansi'];
        $schema = UI_COMMANDS[$name];
        foreach (($payload['flags'] ?? []) as $flag) {
            if (is_string($flag) && in_array($flag, $schema['flags'], true)) {
                $args[] = '--' . $flag;
            }
        }
        foreach (($payload['options'] ?? []) as $option) {
            $key = $option['key'] ?? null;
            $value = $option['value'] ?? null;
            if (!is_string($key) || !in_array($key, $schema['values'], true) || !is_scalar($value) || trim((string) $value) === '') {
                continue;
            }
            if ($key === 'directory' || ($name === 'code-login' && $key === 'code')) {
                $args[] = (string) $value;
            } else {
                $args[] = '--' . $key . '=' . (string) $value;
            }
        }

        $lock = fopen($root . '/var/ui-job.lock', 'c+');
        if ($lock === false || !flock($lock, LOCK_EX | LOCK_NB)) {
            emit(['type' => 'error', 'message' => 'Another command is already running.']);
            return;
        }
        $logPath = $root . '/var/ui-job.log';
        file_put_contents($logPath, '');
        emit(['type' => 'start', 'command' => $name]);
        $process = proc_open($args, [0 => ['pipe', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes, $root);
        if (!is_resource($process)) {
            throw new RuntimeException('Could not start the command.');
        }
        $status = proc_get_status($process);
        ftruncate($lock, 0);
        rewind($lock);
        fwrite($lock, json_encode(['command' => $name, 'startedAt' => date(DATE_ATOM), 'pid' => $status['pid'] ?? null]));
        fflush($lock);
        fclose($pipes[0]);
        stream_set_blocking($pipes[1], false);
        stream_set_blocking($pipes[2], false);

        while (true) {
            $read = array_filter([$pipes[1], $pipes[2]], fn ($pipe) => !feof($pipe));
            if (!$read) {
                break;
            }
            $write = $except = [];
            if (stream_select($read, $write, $except, 0, 200000) > 0) {
                foreach ($read as $pipe) {
                    $chunk = stream_get_contents($pipe);
                    if ($chunk !== false && $chunk !== '') {
                        file_put_contents($logPath, stripAnsiServer($chunk), FILE_APPEND);
                        emit(['type' => $pipe === $pipes[2] ? 'stderr' : 'stdout', 'data' => $chunk]);
                    }
                }
            }
        }
        fclose($pipes[1]);
        fclose($pipes[2]);
        $exitCode = proc_close($process);
        emit(['type' => 'exit', 'code' => $exitCode]);
        ftruncate($lock, 0);
        flock($lock, LOCK_UN);
        fclose($lock);
    } catch (Throwable $exception) {
        emit(['type' => 'error', 'message' => $exception->getMessage()]);
    }
}

function getActiveJob(string $root): ?array
{
    $path = $root . '/var/ui-job.lock';
    if (!is_file($path)) {
        return null;
    }
    $lock = fopen($path, 'r+');
    if ($lock === false) {
        return null;
    }
    if (flock($lock, LOCK_EX | LOCK_NB)) {
        flock($lock, LOCK_UN);
        fclose($lock);
        return null;
    }
    $contents = stream_get_contents($lock);
    fclose($lock);
    $job = json_decode($contents ?: '', true);
    return is_array($job) ? $job : ['command' => 'unknown'];
}

function emit(array $event): void
{
    echo json_encode($event, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) . "\n";
    if (ob_get_level() > 0) {
        ob_flush();
    }
    flush();
}

function stripAnsiServer(string $value): string
{
    return preg_replace('/\x1B(?:[@-Z\\-_]|\[[0-?]*[ -\/]*[@-~])/', '', str_replace("\r", "\n", $value)) ?? $value;
}
