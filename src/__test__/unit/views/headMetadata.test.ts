import fs from 'fs';
import path from 'path';

describe('social preview metadata', () => {
  const headTemplate = fs.readFileSync(
    path.resolve(process.cwd(), 'views/partials/_head.ejs'),
    'utf8',
  );

  it('uses the production canonical host for preview images', () => {
    const previewImage = 'https://furfriend-finder.com/images/twobao222.jpg';

    expect(headTemplate).toContain(
      `<meta property="og:image" content="${previewImage}">`,
    );
    expect(headTemplate).toContain(
      `<meta name="twitter:image" content="${previewImage}">`,
    );
    expect(headTemplate).not.toContain('https://www.furfriend-finder.com');
  });
});
