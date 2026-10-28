<?php
/**
 * Tests for the Facebook signed_request. Run it with scripts/php-check.sh test.
 *
 * @license GNU General Public License, version 2 (GPL-2.0-only)
 */

use baneforum\fbdeletion\signed_request;

require __DIR__ . '/../signed_request.php';

$failed = 0;
$check = function (string $name, $got, $want) use (&$failed): void {
	$ok = $got === $want;
	echo ($ok ? 'PASS ' : 'FAIL ') . $name . ($ok ? '' : "\n  got:  " . var_export($got, true) . "\n  want: " . var_export($want, true)) . "\n";
	$failed += $ok ? 0 : 1;
};

$encode = fn (string $bytes): string => rtrim(strtr(base64_encode($bytes), '+/', '-_'), '=');
$make = function (array $payload, string $secret) use ($encode): string {
	$body = $encode(json_encode($payload));

	return $encode(hash_hmac('sha256', $body, $secret, true)) . '.' . $body;
};

$secret = 'app-secret';
$good = $make(['algorithm' => 'HMAC-SHA256', 'user_id' => '1234567890'], $secret);

$check('a good request gives the payload', signed_request::parse($good, $secret)['user_id'] ?? null, '1234567890');
$check('a wrong secret is refused', signed_request::parse($good, 'other'), null);
$check('no secret is refused', signed_request::parse($good, ''), null);
$check('a changed payload is refused', signed_request::parse(explode('.', $good)[0] . '.' . $encode(json_encode(['algorithm' => 'HMAC-SHA256', 'user_id' => '1'])), $secret), null);
$check('another algorithm is refused', signed_request::parse($make(['algorithm' => 'none', 'user_id' => '1'], $secret), $secret), null);
$check('no dot is refused', signed_request::parse('abc', $secret), null);
$check('two dots are refused', signed_request::parse($good . '.x', $secret), null);
$check('text that is not base64url is refused', signed_request::parse('!!!.???', $secret), null);
$check('an empty request is refused', signed_request::parse('', $secret), null);

$check('the code has 32 hex characters', preg_match('/^[0-9a-f]{32}$/', signed_request::code('1234567890', $secret)), 1);
$check('the code depends on the id', signed_request::code('1', $secret) === signed_request::code('2', $secret), false);
$check('the code depends on the secret', signed_request::code('1', $secret) === signed_request::code('1', 'other'), false);

exit($failed === 0 ? 0 : 1);
