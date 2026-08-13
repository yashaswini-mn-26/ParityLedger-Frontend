import React, { useRef, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import type { Comment, PageDoc } from '../api/types';
import { useToast } from './Toast';

function initials(name: string) {
  return name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();
}

function readImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (file.size > 4 * 1024 * 1024) { reject(new Error('Image too large — keep under 4MB')); return; }
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Could not read image'));
    reader.readAsDataURL(file);
  });
}

function CommentRow({
  c, replies, onReply, onDelete, canDelete,
}: {
  c: Comment;
  replies: Comment[];
  onReply: (parentId: string, text: string) => Promise<void>;
  onDelete: (id: string) => void;
  canDelete: (c: Comment) => boolean;
}) {
  const [replying, setReplying] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [posting, setPosting] = useState(false);

  async function submitReply() {
    if (!replyText.trim()) return;
    setPosting(true);
    try {
      await onReply(c.id, replyText.trim());
      setReplyText('');
      setReplying(false);
    } finally {
      setPosting(false);
    }
  }

  return (
    <div className="comment-item" key={c.id}>
      <div className="comment-avatar">{initials(c.author_name || '?')}</div>
      <div className="comment-body">
        <div className="comment-meta">
          <b>{c.author_name}</b>
          <span className="badge role" style={{ fontSize: 9.5 }}>{c.author_role}</span>
          <span>{new Date(c.created_at).toLocaleString()}</span>
          <button className="comment-del" onClick={() => setReplying((r) => !r)}>reply</button>
          {canDelete(c) && <button className="comment-del" onClick={() => onDelete(c.id)}>delete</button>}
        </div>
        {c.text && <div className="comment-text">{c.text}</div>}
        {c.image && <img className="comment-img" src={c.image} />}

        {replying && (
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <input
              type="text"
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder={`Reply to ${c.author_name}…`}
              style={{ flex: 1, background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 7, padding: '6px 10px', color: 'var(--text)', fontSize: 12 }}
            />
            <button className="btn btn-sm" disabled={posting} onClick={submitReply}>{posting ? 'Posting…' : 'Post'}</button>
          </div>
        )}

        {replies.length > 0 && (
          <div style={{ marginTop: 10, paddingLeft: 16, borderLeft: '2px solid var(--border)' }}>
            {replies.map((r) => (
              <div className="comment-item" key={r.id} style={{ marginBottom: 10 }}>
                <div className="comment-avatar" style={{ width: 26, height: 26, fontSize: 10.5 }}>{initials(r.author_name || '?')}</div>
                <div className="comment-body">
                  <div className="comment-meta">
                    <b>{r.author_name}</b>
                    <span className="badge role" style={{ fontSize: 9.5 }}>{r.author_role}</span>
                    <span>{new Date(r.created_at).toLocaleString()}</span>
                    {canDelete(r) && <button className="comment-del" onClick={() => onDelete(r.id)}>delete</button>}
                  </div>
                  {r.text && <div className="comment-text">{r.text}</div>}
                  {r.image && <img className="comment-img" src={r.image} />}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function CommentsPanel({ page, onUpdated }: { page: PageDoc; onUpdated: (p: PageDoc) => void }) {
  const [text, setText] = useState('');
  const [image, setImage] = useState('');
  const [posting, setPosting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();
  const toast = useToast();

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setImage(await readImage(file));
    } catch (err: any) {
      toast(err.message);
    }
  }

  async function post() {
    if (!text.trim() && !image) { toast('Write something or attach an image'); return; }
    setPosting(true);
    try {
      const updated = await api.addComment(page.id, { text: text.trim(), image });
      onUpdated(updated);
      setText(''); setImage('');
      if (fileRef.current) fileRef.current.value = '';
    } catch (e: any) {
      toast(e.message);
    } finally {
      setPosting(false);
    }
  }

  async function reply(parentId: string, replyText: string) {
    try {
      const updated = await api.addComment(page.id, { text: replyText, parent_id: parentId });
      onUpdated(updated);
    } catch (e: any) {
      toast(e.message);
    }
  }

  async function remove(commentId: string) {
    try {
      const updated = await api.deleteComment(page.id, commentId);
      onUpdated(updated);
    } catch (e: any) {
      toast(e.message);
    }
  }

  function canDelete(c: Comment) {
    return user?.role === 'admin' || user?.id === c.author_id;
  }

  const roots = page.comments.filter((c) => !c.parent_id);
  const repliesOf = (id: string) => page.comments.filter((c) => c.parent_id === id).sort((a, b) => a.created_at.localeCompare(b.created_at));

  return (
    <div>
      <div className="field">
        <label>Add a comment</label>
        <textarea rows={2} value={text} onChange={(e) => setText(e.target.value)} placeholder="Note a discrepancy, ask a question, or leave feedback…" />
      </div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 14 }}>
        <label className="file-drop" style={{ flex: 1 }}>
          {image ? 'Image attached — click to replace' : 'Attach a screenshot'}
          <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFile} />
        </label>
        <button className="btn btn-accent btn-sm" disabled={posting} onClick={post}>{posting ? 'Posting…' : 'Post comment'}</button>
      </div>
      {image && <img className="thumb-preview" src={image} style={{ maxWidth: 160, marginBottom: 14 }} />}

      {roots.length === 0 ? (
        <div className="compare-empty">No comments yet.</div>
      ) : (
        [...roots].reverse().map((c) => (
          <CommentRow key={c.id} c={c} replies={repliesOf(c.id)} onReply={reply} onDelete={remove} canDelete={canDelete} />
        ))
      )}
    </div>
  );
}