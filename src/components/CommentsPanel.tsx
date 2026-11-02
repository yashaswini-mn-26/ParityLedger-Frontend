
import React, { useRef, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import type { Comment, PageDoc } from '../api/types';
import { useToast } from './Toast';
import { ImageLightbox } from './ImageLightbox';

const MAX_IMAGES = 6;

function initials(name: string) {
  return name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function readImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (file.size > 4 * 1024 * 1024) {
      reject(new Error('Image too large — keep under 4MB'));
      return;
    }

    const reader = new FileReader();

    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Could not read image'));

    reader.readAsDataURL(file);
  });
}

function ImageStrip({
  images,
  onClick,
}: {
  images: string[];
  onClick: (src: string) => void;
}) {
  if (!images || images.length === 0) return null;

  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 6,
        marginTop: 6,
      }}
    >
      {images.map((src, i) => (
        <img
          key={i}
          className="comment-img"
          src={src}
          alt={`Comment attachment ${i + 1}`}
          style={{ cursor: 'zoom-in', maxWidth: 140 }}
          onClick={() => onClick(src)}
        />
      ))}
    </div>
  );
}

/**
 * Comments only carry an image_count from the server.
 * Actual image bytes are fetched on demand and cached by CommentsPanel.
 */
function CommentImageSection({
  commentId,
  count,
  cache,
  loading,
  onLoad,
  onImageClick,
}: {
  commentId: string;
  count: number;
  cache: Record<string, string[]>;
  loading: Record<string, boolean>;
  onLoad: (commentId: string) => void;
  onImageClick: (src: string) => void;
}) {
  if (!count) return null;

  const images = cache[commentId];

  if (images) {
    return (
      <ImageStrip
        images={images}
        onClick={onImageClick}
      />
    );
  }

  return (
    <button
      type="button"
      className="comment-del"
      style={{ marginTop: 6 }}
      disabled={!!loading[commentId]}
      onClick={() => onLoad(commentId)}
    >
      {loading[commentId]
        ? 'Loading…'
        : `Show ${count} image${count > 1 ? 's' : ''}`}
    </button>
  );
}

function CommentRow({
  c,
  replies,
  onReply,
  onDelete,
  canDelete,
  onImageClick,
  imageCache,
  loadingImages,
  onLoadImages,
}: {
  c: Comment;
  replies: Comment[];
  onReply: (parentId: string, text: string) => Promise<void>;
  onDelete: (id: string) => void;
  canDelete: (c: Comment) => boolean;
  onImageClick: (src: string) => void;
  imageCache: Record<string, string[]>;
  loadingImages: Record<string, boolean>;
  onLoadImages: (commentId: string) => void;
}) {
  const [replying, setReplying] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [posting, setPosting] = useState(false);

  async function submitReply() {
    if (!replyText.trim() || posting) return;

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
      <div className="comment-avatar">
        {initials(c.author_name || '?')}
      </div>

      <div className="comment-body">
        <div className="comment-meta">
          <b>{c.author_name}</b>

          <span className="badge role" style={{ fontSize: 9.5 }}>
            {c.author_role === 'demo' ? 'Demo' : c.author_role}
          </span>

          <span>{new Date(c.created_at).toLocaleString()}</span>

          <button
            className="comment-del"
            onClick={() => setReplying((r) => !r)}
          >
            reply
          </button>

          {canDelete(c) && (
            <button
              className="comment-del"
              onClick={() => onDelete(c.id)}
            >
              delete
            </button>
          )}
        </div>

        {c.text && (
          <div className="comment-text">{c.text}</div>
        )}

        <CommentImageSection
          commentId={c.id}
          count={c.image_count}
          cache={imageCache}
          loading={loadingImages}
          onLoad={onLoadImages}
          onImageClick={onImageClick}
        />

        {replying && (
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <input
              type="text"
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder={`Reply to ${c.author_name}…`}
              style={{
                flex: 1,
                background: 'var(--surface2)',
                border: '1px solid var(--border)',
                borderRadius: 7,
                padding: '6px 10px',
                color: 'var(--text)',
                fontSize: 12,
              }}
            />

            <button
              className="btn btn-sm"
              disabled={posting}
              onClick={submitReply}
            >
              {posting ? 'Posting…' : 'Post'}
            </button>
          </div>
        )}

        {replies.length > 0 && (
          <div
            style={{
              marginTop: 10,
              paddingLeft: 16,
              borderLeft: '2px solid var(--border)',
            }}
          >
            {replies.map((r) => (
              <div
                className="comment-item"
                key={r.id}
                style={{ marginBottom: 10 }}
              >
                <div
                  className="comment-avatar"
                  style={{
                    width: 26,
                    height: 26,
                    fontSize: 10.5,
                  }}
                >
                  {initials(r.author_name || '?')}
                </div>

                <div className="comment-body">
                  <div className="comment-meta">
                    <b>{r.author_name}</b>

                    <span className="badge role" style={{ fontSize: 9.5 }}>
                      {r.author_role === 'demo' ? 'Demo' : r.author_role}
                    </span>

                    <span>
                      {new Date(r.created_at).toLocaleString()}
                    </span>

                    {canDelete(r) && (
                      <button
                        className="comment-del"
                        onClick={() => onDelete(r.id)}
                      >
                        delete
                      </button>
                    )}
                  </div>

                  {r.text && (
                    <div className="comment-text">{r.text}</div>
                  )}

                  <CommentImageSection
                    commentId={r.id}
                    count={r.image_count}
                    cache={imageCache}
                    loading={loadingImages}
                    onLoad={onLoadImages}
                    onImageClick={onImageClick}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function CommentsPanel({
  page,
  onUpdated,
}: {
  page: PageDoc;
  onUpdated: (p: PageDoc) => void;
}) {
  const [text, setText] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [posting, setPosting] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [imageCache, setImageCache] = useState<Record<string, string[]>>({});
  const [loadingImages, setLoadingImages] = useState<Record<string, boolean>>({});

  const fileRef = useRef<HTMLInputElement>(null);

  const { user } = useAuth();
  const toast = useToast();

  async function loadImages(commentId: string) {
    if (imageCache[commentId] || loadingImages[commentId]) return;

    setLoadingImages((s) => ({ ...s, [commentId]: true }));

    try {
      const fetched = await api.getCommentImages(page.id, commentId);

      setImageCache((s) => ({
        ...s,
        [commentId]: fetched,
      }));
    } catch (e: any) {
      toast(e.message || 'Could not load images');
    } finally {
      setLoadingImages((s) => ({
        ...s,
        [commentId]: false,
      }));
    }
  }

  async function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);

    if (files.length === 0) return;

    const room = MAX_IMAGES - images.length;

    if (room <= 0) {
      toast(`Maximum ${MAX_IMAGES} images allowed`);
      e.target.value = '';
      return;
    }

    const toRead = files.slice(0, room);

    if (files.length > room) {
      toast(`Only added ${room} — max ${MAX_IMAGES} images per comment`);
    }

    try {
      const dataUrls = await Promise.all(toRead.map(readImage));

      setImages((s) => [...s, ...dataUrls]);
    } catch (err: any) {
      toast(err.message || 'Could not attach image');
    }

    e.target.value = '';
  }

  function removeImage(i: number) {
    setImages((s) => s.filter((_, idx) => idx !== i));
  }

  async function post() {
    if (posting) return;

    if (!text.trim() && images.length === 0) {
      toast('Write something or attach an image');
      return;
    }

    setPosting(true);

    try {
      const updated = await api.addComment(page.id, {
        text: text.trim(),
        images,
      });

      onUpdated(updated);

      // Seed the cache with images already available locally.
      if (images.length > 0 && updated.comments.length > 0) {
        const newest = updated.comments[updated.comments.length - 1];

        setImageCache((s) => ({
          ...s,
          [newest.id]: images,
        }));
      }

      setText('');
      setImages([]);

      if (fileRef.current) {
        fileRef.current.value = '';
      }
    } catch (e: any) {
      toast(e.message || 'Could not post comment');
    } finally {
      setPosting(false);
    }
  }

  async function reply(parentId: string, replyText: string) {
    try {
      const updated = await api.addComment(page.id, {
        text: replyText,
        parent_id: parentId,
      });

      onUpdated(updated);
    } catch (e: any) {
      toast(e.message || 'Could not post reply');
      throw e;
    }
  }

  async function remove(commentId: string) {
    try {
      const updated = await api.deleteComment(page.id, commentId);
      onUpdated(updated);

      setImageCache((s) => {
        const next = { ...s };
        delete next[commentId];
        return next;
      });
    } catch (e: any) {
      toast(e.message || 'Could not delete comment');
    }
  }

  function canDelete(c: Comment) {
    return user?.role === 'admin' || user?.id === c.author_id;
  }

  const roots = page.comments.filter((c) => !c.parent_id);

  const repliesOf = (id: string) =>
    page.comments
      .filter((c) => c.parent_id === id)
      .sort((a, b) => a.created_at.localeCompare(b.created_at));

  return (
    <div>
      <div className="field">
        <label>Add a comment</label>

        <textarea
          rows={2}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Note a discrepancy, ask a question, or leave feedback…"
          disabled={posting}
        />
      </div>

      <div
        style={{
          display: 'flex',
          gap: 10,
          alignItems: 'center',
          marginBottom: 10,
        }}
      >
        <label className="file-drop" style={{ flex: 1 }}>
          {images.length >= MAX_IMAGES
            ? `Max ${MAX_IMAGES} images reached`
            : `Attach screenshots (${images.length}/${MAX_IMAGES})`}

          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            style={{ display: 'none' }}
            disabled={posting || images.length >= MAX_IMAGES}
            onChange={handleFiles}
          />
        </label>

        <button
          className="btn btn-accent btn-sm"
          disabled={posting}
          onClick={post}
        >
          {posting ? 'Posting…' : 'Post comment'}
        </button>
      </div>

      {images.length > 0 && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 8,
            marginBottom: 14,
          }}
        >
          {images.map((src, i) => (
            <div className="thumb-wrap" key={i}>
              <img
                className="thumb-preview"
                src={src}
                alt={`Preview ${i + 1}`}
                style={{ maxWidth: 120 }}
              />

              <div className="thumb-overlay">
                <button
                  type="button"
                  className="thumb-btn thumb-btn-danger"
                  title="Remove image"
                  onClick={() => removeImage(i)}
                  disabled={posting}
                >
                  <svg
                    width="13"
                    height="13"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <path
                      d="M18 6L6 18M6 6l12 12"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {roots.length === 0 ? (
        <div className="compare-empty">No comments yet.</div>
      ) : (
        [...roots].reverse().map((c) => (
          <CommentRow
            key={c.id}
            c={c}
            replies={repliesOf(c.id)}
            onReply={reply}
            onDelete={remove}
            canDelete={canDelete}
            onImageClick={setLightbox}
            imageCache={imageCache}
            loadingImages={loadingImages}
            onLoadImages={loadImages}
          />
        ))
      )}

      <ImageLightbox
        src={lightbox}
        onClose={() => setLightbox(null)}
      />
    </div>
  );
}
