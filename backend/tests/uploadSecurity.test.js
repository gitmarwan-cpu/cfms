'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { validateUploadedFileSignatures } = require('../src/middlewares/upload');

const createTempFile = (contents) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'cfms-upload-test-'));
  const filePath = path.join(directory, 'upload.bin');
  fs.writeFileSync(filePath, contents);
  return { directory, filePath };
};

const removeTempDirectory = (directory) => {
  fs.rmSync(directory, { recursive: true, force: true });
};

describe('uploaded file signature validation', () => {
  it('accepts a PNG whose content matches its declared MIME type', async () => {
    const { directory, filePath } = createTempFile(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    const next = jest.fn();

    try {
      await validateUploadedFileSignatures({ files: [{ path: filePath, mimetype: 'image/png' }] }, {}, next);
      expect(next).toHaveBeenCalledWith();
      expect(fs.existsSync(filePath)).toBe(true);
    } finally {
      removeTempDirectory(directory);
    }
  });

  it('rejects content that does not match its declared MIME type and removes it', async () => {
    const { directory, filePath } = createTempFile(Buffer.from('not a png'));
    const next = jest.fn();

    try {
      await validateUploadedFileSignatures({ files: [{ path: filePath, mimetype: 'image/png' }] }, {}, next);
      expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 422 }));
      expect(fs.existsSync(filePath)).toBe(false);
    } finally {
      removeTempDirectory(directory);
    }
  });
});
