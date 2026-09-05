import { safeReturnTo } from '../../libs/safeReturnTo';

describe('safeReturnTo', () => {
  it.each(['/profile', '/report-lost', '/'])('allows %s', path => {
    expect(safeReturnTo(path)).toBe(path);
  });

  it.each(['https://evil.example', '//evil.example', '/\\evil', '/profile?next=https://evil.example'])('rejects unsafe return path %s', path => {
		expect(safeReturnTo(path)).toBe('/');
  });
});
