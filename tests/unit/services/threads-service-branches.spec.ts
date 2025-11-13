import { describe, it, expect, beforeEach } from 'vitest';
import ThreadRepository from '../../../src-electron/repository/thread-repository';

describe('ThreadRepository branches (error paths)', () => {
  let svc: ThreadRepository;

  beforeEach(() => {
    svc = new ThreadRepository();
    svc.clearAll();
  });

  it('addMessage throws when thread missing', () => {
    expect(() => svc.addMessage('missing', 'user', 'hi')).toThrow('Thread not found');
  });

  it('addAssistantResponse throws when thread missing', () => {
    expect(() => svc.addAssistantResponse('missing', 'resp')).toThrow('Thread not found');
  });

  it('updateThreadMetadata throws when thread missing', () => {
    expect(() => svc.updateThreadMetadata('nope', { model: 'm' })).toThrow('Thread not found');
  });

  it('replaceMessages throws when thread missing', () => {
    expect(() =>
      svc.replaceMessages('nope', [
        { id: 'm1', role: 'user', content: 'x', createdAt: Date.now(), title: 'x' },
      ]),
    ).toThrow('Thread not found');
  });

  it('deleteThread returns false when missing and true when exists', () => {
    const ok1 = svc.deleteThread('no');
    expect(ok1).toBe(false);

    const t = svc.createThread({ title: 'x' });
    const ok2 = svc.deleteThread(t.id);
    expect(ok2).toBe(true);
  });

  it('saveThread creates when id not present and updates when present', () => {
    const newThread = {
      id: 'custom-id',
      metadata: { title: 'T1' },
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    } as const;

    const saved = svc.saveThread(newThread as unknown as any);
    expect(saved.id).toBe('custom-id');

    // update existing
    const updated = svc.saveThread({ ...saved, metadata: { title: 'T2' } });
    expect(updated.metadata.title).toBe('T2');
  });

  it('addUserPrompt with existing threadId appends message', () => {
    const t = svc.createThread({ title: 'exists' });
    const res = svc.addUserPrompt(t.id, 'hello');
    expect(res.thread.id).toBe(t.id);
    expect(res.message.content).toBe('hello');
  });

  it('addAssistantResponse without model does not set metadata.model', () => {
    const t = svc.createThread({ title: 'no-model' });
    const before = svc.getThreadModel(t.id);
    expect(before).toBeUndefined();
    const m = svc.addAssistantResponse(t.id, 'resp');
    expect(m.content).toBe('resp');
    const after = svc.getThreadModel(t.id);
    expect(after).toBeUndefined();
  });

  it('replaceMessages replaces messages when thread exists', () => {
    const t = svc.createThread({ title: 'r' });
    svc.addMessage(t.id, 'user', 'old');
    const newMsgs = [
      { id: 'x', role: 'assistant' as const, content: 'n1', createdAt: Date.now(), title: 'x' },
    ];
    const updated = svc.replaceMessages(t.id, newMsgs);
    expect(updated.messages).toHaveLength(1);
    expect(updated.messages[0].content).toBe('n1');
  });

  it('savePromptAndResponses works with empty responses array', () => {
    const out = svc.savePromptAndResponses(null, 'Q', [], { title: 'Empty' });
    expect(out.promptMessage.content).toBe('Q');
    expect(out.responseMessages).toHaveLength(0);
    expect(out.thread.metadata.title).toBe('Empty');
  });

  it('getThreadModel returns model when set and undefined otherwise', () => {
    const t = svc.createThread({ title: 'mtest', model: 'mm' as unknown as string });
    expect(svc.getThreadModel(t.id)).toBe('mm');
    // set non-string
    svc.updateThreadMetadata(t.id, { model: 123 as unknown as string });
    expect(svc.getThreadModel(t.id)).toBeUndefined();
  });
});
