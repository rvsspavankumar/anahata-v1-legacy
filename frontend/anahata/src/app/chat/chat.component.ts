import { AfterViewChecked, Component, ElementRef, OnDestroy, SecurityContext, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { NavigationEnd, Router } from '@angular/router';
import { DomSanitizer } from '@angular/platform-browser';
import { filter } from 'rxjs/operators';

type ChatRole = 'user' | 'assistant';

interface ChatMessage {
  role: ChatRole;
  content: string;
  timestamp: string;
}

interface ChatRequest {
  userName: string;
  moodScore: number;
  message: string;
  history: ChatMessage[];
}

interface ChatResponse {
  reply: string;
}

type ChatHistoryByUser = Record<string, ChatMessage[]>;

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './chat.component.html',
  styleUrl: './chat.component.scss'
})
export class ChatComponent implements AfterViewChecked, OnDestroy {
  private readonly chatApiUrl = 'http://localhost:5097/api/chat';
  private readonly storageKey = 'anahata_chat_histories_v1';
  private readonly maxTurns = 10;

  userName = 'Guest';
  moodScore = 0;
  messageInput = '';
  isSending = false;
  isMessagesScrolling = false;
  messages: ChatMessage[] = [];
  private shouldScrollToBottom = false;
  private messagesScrollTimeout?: ReturnType<typeof setTimeout>;
  @ViewChild('messagesContainer') private messagesContainer?: ElementRef<HTMLDivElement>;

  constructor(private http: HttpClient, private router: Router, private sanitizer: DomSanitizer) {
    this.loadContextAndHistory();

    this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe(() => this.loadContextAndHistory());
  }

  private loadContextAndHistory(): void {
    const nav = window.history.state;
    if (nav?.userName) {
      this.userName = String(nav.userName);
      sessionStorage.setItem('userName', this.userName);
    } else {
      this.userName = sessionStorage.getItem('userName') ?? 'Guest';
    }

    this.moodScore = Number(nav?.moodScore ?? 0);
    this.isSending = false;
    this.messageInput = '';
    this.messages = this.restoreHistoryForUser(this.userName);
    this.shouldScrollToBottom = true;
  }

  get isStarterView(): boolean {
    return this.messages.length === 0;
  }

  sendMessage(): void {
    const trimmed = this.messageInput.trim();
    if (!trimmed || this.isSending) {
      return;
    }

    this.pushMessage('user', trimmed);
    this.messageInput = '';
    this.resetMessageInputHeight();
    this.isSending = true;

    const request: ChatRequest = {
      userName: this.userName,
      moodScore: this.moodScore,
      message: trimmed,
      history: this.messages
    };

    this.http.post<ChatResponse>(this.chatApiUrl, request).subscribe({
      next: (response) => {
        const reply = (response.reply ?? '').trim();
        this.pushMessage('assistant', reply || 'Model returned an empty response.');
        console.log('Chat API response:', response);
        this.isSending = false;
      },
      error: (err: HttpErrorResponse) => {
        const errorReply = (err.error && typeof err.error === 'object' && 'reply' in err.error)
          ? String((err.error as { reply: string }).reply)
          : `Chat API error (${err.status || 0}). Check backend run state and LLM settings.`;

        this.pushMessage('assistant', errorReply);
        console.error('Chat API error:', err);
        this.isSending = false;
      }
    });
  }

  resizeMessageInput(event: Event): void {
    const textarea = event.target as HTMLTextAreaElement;
    const maxHeight = 59;
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, maxHeight)}px`;
    textarea.style.overflowY = textarea.scrollHeight > maxHeight ? 'auto' : 'hidden';
  }

  handleMessageKeydown(event: Event): void {
    const keyboardEvent = event as KeyboardEvent;
    if (keyboardEvent.shiftKey) {
      return;
    }

    keyboardEvent.preventDefault();
    this.sendMessage();
  }

  handleMessagesScroll(): void {
    this.isMessagesScrolling = true;
    clearTimeout(this.messagesScrollTimeout);
    this.messagesScrollTimeout = setTimeout(() => {
      this.isMessagesScrolling = false;
    }, 700);
  }

  trackByIndex(index: number): number {
    return index;
  }

  private resetMessageInputHeight(): void {
    requestAnimationFrame(() => {
      const textarea = document.querySelector<HTMLTextAreaElement>('.starter-input-row textarea, .bottom-input-row textarea');
      if (textarea) {
        textarea.style.height = 'auto';
        textarea.style.overflowY = 'hidden';
      }
    });
  }

  goToDashboard(): void {
    this.router.navigate(['/dashboard']);
  }

  logoff(): void {
    sessionStorage.removeItem('userName');
    this.router.navigate(['/']);
  }

  ngAfterViewChecked(): void {
    if (!this.shouldScrollToBottom || !this.messagesContainer) {
      return;
    }

    this.messagesContainer.nativeElement.scrollTop = this.messagesContainer.nativeElement.scrollHeight;
    this.shouldScrollToBottom = false;
  }

  ngOnDestroy(): void {
    clearTimeout(this.messagesScrollTimeout);
  }

  renderMessage(content: string): string {
    const escaped = this.escapeHtml(content);

    let html = escaped
      .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\*([^*]+)\*/g, '<em>$1</em>')
      .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
      .replace(/\n/g, '<br>');

    html = this.sanitizer.sanitize(SecurityContext.HTML, html) ?? '';
    return html;
  }

  private pushMessage(role: ChatRole, content: string): void {
    this.messages.push({
      role,
      content,
      timestamp: new Date().toISOString()
    });

    const maxMessages = this.maxTurns * 2;
    if (this.messages.length > maxMessages) {
      this.messages = this.messages.slice(this.messages.length - maxMessages);
    }

    this.persistHistoryForUser(this.userName, this.messages);
    this.shouldScrollToBottom = true;
  }

  private restoreHistoryForUser(userName: string): ChatMessage[] {
    const allHistories = this.readAllHistories();
    const userKey = this.toUserKey(userName);
    const history = allHistories[userKey];

    if (!Array.isArray(history)) {
      return [];
    }

    const cleaned = history.filter((msg) =>
      msg.content !== 'I hear you. Tell me a little more.' &&
      msg.content !== 'I am listening. Please continue, and I will support you.'
    );

    return cleaned.slice(-this.maxTurns * 2);
  }

  private persistHistoryForUser(userName: string, history: ChatMessage[]): void {
    const allHistories = this.readAllHistories();
    const userKey = this.toUserKey(userName);
    allHistories[userKey] = history.slice(-this.maxTurns * 2);
    localStorage.setItem(this.storageKey, JSON.stringify(allHistories));
  }

  private readAllHistories(): ChatHistoryByUser {
    const raw = localStorage.getItem(this.storageKey);
    if (!raw) {
      return {};
    }

    try {
      const parsed = JSON.parse(raw) as ChatHistoryByUser | ChatMessage[];

      // Backward compatibility for old single-history format.
      if (Array.isArray(parsed)) {
        return { guest: parsed.slice(-this.maxTurns * 2) };
      }

      if (parsed && typeof parsed === 'object') {
        return parsed;
      }
    } catch {
      return {};
    }

    return {};
  }

  private toUserKey(userName: string): string {
    const normalized = userName.trim().toLowerCase();
    return normalized || 'guest';
  }

  private escapeHtml(input: string): string {
    return input
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}
