<?php
/**
 * Tests for the Markdown detector. Run it where PHP is:
 *   docker compose exec web php ext/baneforum/editor/tests/markdown_detector_test.php
 */

require __DIR__ . '/../markdown_detector.php';

use baneforum\editor\markdown_detector;

$failed = 0;
$detector = new markdown_detector();
$check = function (string $name, string $xml, bool $want) use (&$failed, $detector): void {
	$got = $detector->contains_markdown($xml);
	$ok = $got === $want;
	echo ($ok ? 'PASS ' : 'FAIL ') . $name . "\n";
	$failed += $ok ? 0 : 1;
};

// Markdown
$check('bold', '<r><STRONG><s>**</s>x<e>**</e></STRONG></r>', true);
$check('italic', '<r><EM><s>*</s>x<e>*</e></EM></r>', true);
$check('heading', '<r><H1><s># </s>Title</H1></r>', true);
$check('rule', '<r><HR>---</HR></r>', true);
$check('inline code', '<r><C><s>`</s>x<e>`</e></C></r>', true);
$check('table', '<r><TABLE><THEAD><TR><TH>a</TH></TR></THEAD></TABLE></r>', true);
$check('Markdown list item', '<r><LIST><LI><s>- </s>one</LI></LIST></r>', true);
$check('numbered list item', '<r><LIST type="decimal"><LI><s>1. </s>one</LI></LIST></r>', true);
$check('Markdown link', '<r><URL url="http://a"><s>[</s>text<e>](http://a)</e></URL></r>', true);
$check('code fence', '<r><CODE><s>```</s>x<e>```</e></CODE></r>', true);

// BBCode and plain text
$check('plain text', '<t>just text</t>', false);
$check('BBCode bold', '<r><B><s>[b]</s>x<e>[/b]</e></B></r>', false);
$check('BBCode italic', '<r><I><s>[i]</s>x<e>[/i]</e></I></r>', false);
$check('BBCode list', '<r><LIST><s>[list]</s><LI><s>[*]</s>one</LI><e>[/list]</e></LIST></r>', false);
$check('BBCode link', '<r><URL url="http://a"><s>[url=http://a]</s>x<e>[/url]</e></URL></r>', false);
$check('BBCode url', '<r><URL url="http://a"><s>[url]</s>http://a<e>[/url]</e></URL></r>', false);
$check('BBCode code', '<r><CODE><s>[code]</s>x<e>[/code]</e></CODE></r>', false);
$check('quote and attachment', '<r><QUOTE author="a"><s>[quote]</s>x<e>[/quote]</e></QUOTE><ATTACHMENT index="0"><s>[attachment=0]</s>f<e>[/attachment]</e></ATTACHMENT></r>', false);
$check('emoji', '<r><E>:)</E></r>', false);

echo $failed === 0 ? "All passed\n" : "$failed failed\n";
exit($failed === 0 ? 0 : 1);
