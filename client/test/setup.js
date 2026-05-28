import '@testing-library/jest-dom';
import { beforeEach } from 'vitest';
import { clearAuthorDetailCache } from '../src/hooks/useAuthorDetail';

beforeEach(() => {
  clearAuthorDetailCache();
});
