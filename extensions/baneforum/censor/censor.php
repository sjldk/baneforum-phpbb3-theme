<?php
/**
 * Baneforum censor
 *
 * @license GNU General Public License, version 2 (GPL-2.0-only)
 */

namespace baneforum\censor;

use s9e\TextFormatter\Configurator;

/**
 * Censors the text of a rendered post, but not the URLs in it.
 *
 * The censor of phpBB works on the whole HTML, including `href` and `src`, so a word in an address changes the address
 * and the link breaks. Here only the text is censored, and a piece of text that is a URL is kept as it is.
 */
class censor
{
	/** A web address in text, with or without a link around it. */
	protected const URL = '#((?:https?|ftp)://[^\s<]+|www\.[^\s<]+|mailto:[^\s<]+)#i';

	/**
	 * The censor helper of the s9e library. Null until the words are loaded, false if there are none.
	 *
	 * @var \s9e\TextFormatter\Plugins\Censor\Helper|null|false
	 */
	protected $helper = null;

	/**
	 * Sets where the censor words come from.
	 *
	 * @param \phpbb\textformatter\data_access|null $data_access  Where the ACP words are read from. Null if the words are given to set_words().
	 */
	public function __construct(protected $data_access = null)
	{
	}

	/**
	 * Builds the censor helper from a list of words. An empty list switches censoring off.
	 *
	 * @param array<int, array{word: string, replacement: string}> $words  The words with their replacements
	 *
	 * @return void
	 */
	public function set_words(array $words): void
	{
		if ($words === [])
		{
			$this->helper = false;

			return;
		}

		$configurator = new Configurator();
		$configurator->plugins->load('Censor');

		foreach ($words as $row)
		{
			$configurator->Censor->add($row['word'], $row['replacement']);
		}

		$this->helper = $configurator->Censor->getHelper();
	}

	/**
	 * Censors the text of rendered HTML. Tags are kept as they are, and so is the text of a link that shows its own address.
	 * The words are loaded the first time this is called.
	 *
	 * @param string $html  The rendered HTML of a post
	 *
	 * @return string  The HTML with the text censored
	 */
	public function censor_html(string $html): string
	{
		if ($this->helper === null)
		{
			$this->set_words($this->data_access?->get_censored_words() ?? []);
		}

		if ($this->helper === false || $html === '')
		{
			return $html;
		}

		$tokens = preg_split('/(<[^>]*>)/', $html, -1, PREG_SPLIT_DELIM_CAPTURE);
		$count = count($tokens);
		$out = '';

		for ($i = 0; $i < $count; $i++)
		{
			$token = $tokens[$i];

			if ($i % 2 === 1)
			{
				$out .= $token;

				// A link that shows its own address is kept whole. A link with words as its text is censored like any text.
				if (preg_match('/^<a\b/i', $token))
				{
					$end = $this->link_end($tokens, $i);
					$text = html_entity_decode(strip_tags(implode('', array_slice($tokens, $i + 1, $end - $i - 1))));

					if ($end < $count && preg_match('#^\s*(?:(?:https?|ftp)://|www\.|mailto:)\S+\s*$#i', $text))
					{
						$out .= implode('', array_slice($tokens, $i + 1, $end - $i));
						$i = $end;
					}
				}

				continue;
			}

			$out .= $this->censor_text($token);
		}

		return $out;
	}

	/**
	 * Finds the closing `</a>` of a link.
	 * The tokens alternate: text at the even places and tags at the odd places, so only the even places are searched.
	 *
	 * @param array<int, string> $tokens  The HTML split into text and tags
	 * @param int $start  The place of the `<a>` tag
	 *
	 * @return int  The place of the closing `</a>`, or the token count if there is none
	 */
	protected function link_end(array $tokens, int $start): int
	{
		for ($j = $start + 2; $j < count($tokens); $j += 2)
		{
			if (preg_match('#^</a\s*>$#i', $tokens[$j]))
			{
				return $j;
			}
		}

		return count($tokens);
	}

	/**
	 * Censors text that sits between tags, without touching the URLs in it.
	 *
	 * @param string $text  The text between two tags
	 *
	 * @return string  The censored text
	 */
	protected function censor_text(string $text): string
	{
		$parts = preg_split(self::URL, $text, -1, PREG_SPLIT_DELIM_CAPTURE);

		foreach ($parts as $n => $part)
		{
			if ($n % 2 === 0 && $part !== '')
			{
				$parts[$n] = $this->helper->censorHtml($part, false);
			}
		}

		return implode('', $parts);
	}
}
