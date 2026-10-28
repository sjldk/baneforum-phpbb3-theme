<?php
/**
 * Baneforum Facebook data deletion
 *
 * @license GNU General Public License, version 2 (GPL-2.0-only)
 */

namespace baneforum\fbdeletion;

/**
 * The signed_request that Facebook sends: a signature and a payload, both in base64url, with a dot between.
 * The signature is HMAC-SHA256 of the encoded payload, made with the secret of the Facebook app.
 */
class signed_request
{
	/**
	 * Checks the signature and reads the payload.
	 *
	 * @param string $request  The signed_request field of the POST.
	 * @param string $secret   The secret of the Facebook app.
	 *
	 * @return array<string, mixed>|null  The payload, or null when anything is wrong (no secret, bad form, bad signature, other algorithm).
	 */
	public static function parse(string $request, string $secret): ?array
	{
		if ($secret === '' || substr_count($request, '.') !== 1)
		{
			return null;
		}

		[$encoded_signature, $encoded_payload] = explode('.', $request);
		$signature = self::decode($encoded_signature);
		$payload = json_decode((string) self::decode($encoded_payload), true);

		if ($signature === null || !is_array($payload) || ($payload['algorithm'] ?? '') !== 'HMAC-SHA256')
		{
			return null;
		}

		if (!hash_equals(hash_hmac('sha256', $encoded_payload, $secret, true), $signature))
		{
			return null;
		}

		return $payload;
	}

	/**
	 * The code that Facebook shows to the member, and that opens the status page. Nobody can make it without the secret.
	 *
	 * @param string $facebook_id  The Facebook user id (the id of the member for this app).
	 * @param string $secret       The secret of the Facebook app.
	 *
	 * @return string  32 hex characters.
	 */
	public static function code(string $facebook_id, string $secret): string
	{
		return substr(hash_hmac('sha256', 'fbdeletion:' . $facebook_id, $secret), 0, 32);
	}

	/**
	 * Reads base64url.
	 *
	 * @param string $text  The encoded text.
	 *
	 * @return string|null  The bytes, or null when the text is not base64url.
	 */
	protected static function decode(string $text): ?string
	{
		$bytes = base64_decode(strtr($text, '-_', '+/'), true);

		return $bytes === false ? null : $bytes;
	}
}
