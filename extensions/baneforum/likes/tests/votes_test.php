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

	exit($failed > 0 ? 1 : 0);
}
