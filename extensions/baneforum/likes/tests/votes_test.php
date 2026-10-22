<?php
/**
 * Tests for the vote rule. Run it where PHP is:
 *   docker compose exec web php ext/baneforum/likes/tests/votes_test.php
 */

namespace phpbb\db\driver
{
	interface driver_interface
	{
	}
}

namespace
{
	require __DIR__ . '/../votes.php';
	require __DIR__ . '/../voter_key.php';

	use baneforum\likes\votes;

	$failed = 0;
	$check = function (string $name, bool $ok) use (&$failed): void {
		echo ($ok ? 'PASS ' : 'FAIL ') . $name . "\n";
		$failed += $ok ? 0 : 1;
	};

	$check('like on nothing gives like', votes::next_value(0, votes::UP) === 1);
	$check('dislike on nothing gives dislike', votes::next_value(0, votes::DOWN) === -1);
	$check('like again removes the vote', votes::next_value(1, votes::UP) === 0);
	$check('dislike again removes the vote', votes::next_value(-1, votes::DOWN) === 0);
	$check('dislike after like switches', votes::next_value(1, votes::DOWN) === -1);
	$check('like after dislike switches', votes::next_value(-1, votes::UP) === 1);
	$check('bad value changes nothing', votes::next_value(1, 5) === 1);

	$file = sys_get_temp_dir() . '/bf-votes-key-' . getmypid();
	$key = new \baneforum\likes\voter_key($file);
	$one = $key->voter(5, 100);
	$check('same member and post give the same value', $one === $key->voter(5, 100) && $one === (new \baneforum\likes\voter_key($file))->voter(5, 100));
	$check('another post gives another value', $one !== $key->voter(5, 101));
	$check('another member gives another value', $one !== $key->voter(6, 100));
	$check('the value is a 64 character hash', preg_match('/^[0-9a-f]{64}$/', $one) === 1);
	$check('the key file is private', (fileperms($file) & 0077) === 0);
	unlink($file);

	exit($failed > 0 ? 1 : 0);
}
