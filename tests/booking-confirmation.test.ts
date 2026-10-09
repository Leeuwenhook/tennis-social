import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isBookingConfirmation } from '../lib/booking-assistant';

void test('explicit Chinese and English confirmations can submit a summarized request', () => {
  for (const content of [
    '确认',
    ' 确认！ ',
    '确认提交',
    '确认并提交',
    'confirm',
    'CONFIRM.',
    'confirm and submit',
  ]) {
    assert.equal(isBookingConfirmation(content), true, content);
  }
});

void test('revisions, questions, and casual acknowledgements do not submit a request', () => {
  for (const content of [
    '',
    '不确认',
    '确认，但是改到周六',
    '确认？',
    '改成单打',
    'confirm but change the time',
    'confirm?',
    'yes',
    'ok',
  ]) {
    assert.equal(isBookingConfirmation(content), false, content);
  }
});
