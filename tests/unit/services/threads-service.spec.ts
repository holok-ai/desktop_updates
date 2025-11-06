import { describe, it, expect, beforeEach } from 'vitest';
import ThreadRepository from '../../../src-electron/repository/thread-repository';

describe('ThreadRepository (unit)', () => {
  let svc: ThreadRepository;

  beforeEach(() => {
    svc = new ThreadRepository();
    svc.clearAll();
  });

  it('createThread returns a thread with metadata and timestamps', () => {
    const t = svc.createThread({ title: 'Hello', description: 'x', model: 'm1' });
    expect(t.id).toBeTruthy();
    expect(t.metadata.title).toBe('Hello');
    expect(t.messages).toHaveLength(0);
  });

  it('addMessage appends messages to a thread', () => {
    const t = svc.createThread({ title: 'T' });
    const m = svc.addMessage(t.id, 'user', 'Hi');
    const loaded = svc.loadThread(t.id)!;
    expect(loaded.messages).toHaveLength(1);
    expect(loaded.messages[0].content).toBe('Hi');
    expect(m.role).toBe('user');
  });

  it('addUserPrompt creates thread when id is null and returns message', () => {
    const res = svc.addUserPrompt(null, 'Prompt', { title: 'New' });
    expect(res.thread).toBeTruthy();
    expect(res.message.content).toBe('Prompt');
  });

  it('addAssistantResponse appends assistant message and sets model', () => {
    const t = svc.createThread({ title: 'X' });
    const m = svc.addAssistantResponse(t.id, 'Response', 'gpt-test');
    const loaded = svc.loadThread(t.id)!;
    expect(loaded.messages.some((mm) => mm.id === m.id)).toBe(true);
    expect(loaded.metadata.model).toBe('gpt-test');
  });

  it('savePromptAndResponses stores prompt and multiple responses', () => {
    const out = svc.savePromptAndResponses(
      null,
      'Q',
      [{ text: 'A1' }, { text: 'A2', model: 'm2' }],
      { title: 'Batch' },
    );
    expect(out.promptMessage.content).toBe('Q');
    expect(out.responseMessages).toHaveLength(2);
    expect(out.thread.metadata.title).toBe('Batch');
  });

  it('listThreadsByModel filters correctly', () => {
    const a = svc.createThread({ title: 'a', model: 'm1' });
    const b = svc.createThread({ title: 'b', model: 'm2' });
    const r = svc.listThreadsByModel('m1');
    expect(r.map((t) => t.id)).toEqual([a.id]);
  });
});
