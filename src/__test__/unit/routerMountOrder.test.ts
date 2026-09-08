import fs from 'fs';
import path from 'path';

it('mounts public configuration and directory before the broad authenticated router', () => {
    const source = fs.readFileSync(
        path.join(__dirname, '..', '..', 'router', 'index.ts'),
        'utf8',
    );
    const authenticated = source.indexOf(
        "app.use('/api/v1', createOrganizationActionRouter())",
    );
    expect(source.indexOf("app.use('/api/v1/config'")).toBeLessThan(
        authenticated,
    );
    expect(
        source.indexOf("app.use('/api/v1/public/organizations'"),
    ).toBeLessThan(authenticated);
});
