import { Component, SecurityContext } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { DomSanitizer } from '@angular/platform-browser';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

interface UserChatSummary {
  userName: string;
  messages: ChatMessage[];
  messageCount: number;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent {
  private readonly storageKey = 'anahata_chat_histories_v1';
  private readonly previewMessagesPerSession = 3;
  private readonly previewCharsPerMessage = 220;
  chatSummaries: UserChatSummary[] = [];

  constructor(private router: Router, private sanitizer: DomSanitizer) {
    this.loadChats();
  }

  goToDashboard(): void {
    this.loadChats();
  }

  logoff(): void {
    sessionStorage.removeItem('userName');
    this.router.navigate(['/']);
  }

  openUserChat(userName: string): void {
    sessionStorage.setItem('userName', userName);
    this.router.navigate(['/chat'], { state: { userName } });
  }

  getPreviewMessages(messages: ChatMessage[]): ChatMessage[] {
    return messages.slice(-this.previewMessagesPerSession);
  }

  getHiddenMessageCount(chat: UserChatSummary): number {
    return Math.max(0, chat.messageCount - this.previewMessagesPerSession);
  }

  renderMessagePreview(content: string): string {
    const preview = content.length > this.previewCharsPerMessage
      ? `${content.slice(0, this.previewCharsPerMessage)}...`
      : content;

    const escaped = this.escapeHtml(preview);
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

  private loadChats(): void {
    const raw = localStorage.getItem(this.storageKey);
    if (!raw) {
      this.chatSummaries = [];
      return;
    }

    try {
      const parsed = JSON.parse(raw) as Record<string, ChatMessage[]>;
      this.chatSummaries = Object.entries(parsed)
        .map(([userName, messages]) => ({
          userName,
          messages: Array.isArray(messages) ? messages : [],
          messageCount: Array.isArray(messages) ? messages.length : 0
        }))
        .sort((a, b) => b.messageCount - a.messageCount);
    } catch {
      this.chatSummaries = [];
    }
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
