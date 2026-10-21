#!/usr/bin/env python3
"""Post messages to the Docker test board as admin and print the rendered HTML.

Usage: scripts/post_test.py 'message one' 'message two' ...
Each message is posted as a reply in topic 1 and the rendered post body is printed.
"""
import html, re, sys, time, urllib.parse, urllib.request, http.cookiejar

BASE = 'http://localhost:8080/'
jar = http.cookiejar.CookieJar()
opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))


final_url = ''


def get(url, data=None):
    global final_url
    response = opener.open(urllib.request.Request(BASE + url, data=data), timeout=30)
    final_url = response.geturl()
    return response.read().decode('utf8', 'replace')


def hidden(page):
    return dict(re.findall(r'<input type="hidden" name="([^"]+)" value="([^"]*)"', page))


def login():
    fields = hidden(get('ucp.php?mode=login'))
    fields.update(username='admin', password='adminadmin', login='Login')
    time.sleep(2)  # phpBB rejects a form that is sent too fast
    get('ucp.php?mode=login', urllib.parse.urlencode(fields).encode())


def reply(message):
    page = get('posting.php?mode=reply&f=2&t=1')
    fields = {k: html.unescape(v) for k, v in hidden(page).items()}
    fields.update(subject='Re: test', message=message, post='Submit')
    time.sleep(2)
    result = get('posting.php?mode=reply&f=2&t=1', urllib.parse.urlencode(fields).encode())
    match = re.search(r'viewtopic\.php\?[^"]*p=(\d+)', final_url)
    if not match:
        errors = re.findall(r'class="error">(.*?)</', result, re.S) or re.findall(r'<title>(.*?)</title>', result)
        return None, 'not posted (%s): %s' % (final_url, errors)
    post_id = match.group(1)
    topic = get('viewtopic.php?p=%s' % post_id)
    body = re.search(r'id="post_content%s".*?<div class="content">(.*?)</div>\n\n' % post_id, topic, re.S)
    return post_id, (body.group(1).strip() if body else 'body not found')
    return post_id, (body.group(1).strip() if body else 'body not found')


if __name__ == '__main__':
    login()
    for message in sys.argv[1:]:
        post_id, rendered = reply(message)
        print('--- %r\n[%s] %s' % (message, post_id, rendered))
