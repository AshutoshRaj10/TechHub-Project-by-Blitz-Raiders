import React from 'react';
import { Plus, MessageSquare, Settings, LogOut, ChevronRight, User as UserIcon, Database, History } from 'lucide-react';

export default function Sidebar({ 
  user, 
  history, 
  activeChatId, 
  onNewChat, 
  onSelectChat, 
  onLogout,
  onOpenSettings 
}) {
  const getAvatarInitials = (name) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().substr(0, 2);
  };

  return (
    <aside className="sidebar-v2 animate-fade-in">
      <div className="sidebar-header">
         <button className="btn-new-chat" onClick={onNewChat}>
            <Plus size={18} />
            <span>New Analysis</span>
         </button>
      </div>

      <div className="sidebar-scroll">
         <div className="history-section">
            <div className="history-label">RECENT CONVERSATIONS</div>
            {history.length === 0 ? (
               <div style={{ padding: '20px', textAlign: 'center', opacity: 0.3 }}>
                  <History size={24} style={{ margin: '0 auto 8px' }} />
                  <p style={{ fontSize: '0.65rem' }}>No history yet</p>
               </div>
            ) : (
               history.map(chat => (
                  <div 
                    key={chat.id} 
                    className={`history-item ${activeChatId === chat.id ? 'active' : ''}`}
                    onClick={() => onSelectChat(chat.id)}
                  >
                     <MessageSquare size={14} />
                     <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {chat.title}
                     </span>
                     <ChevronRight size={10} className="chevron" />
                  </div>
               ))
            )}
         </div>
      </div>

      <div className="sidebar-footer">
         <button className="user-pill" onClick={onOpenSettings}>
            <div className="user-avatar">{getAvatarInitials(user?.name)}</div>
            <div style={{ textAlign: 'left' }}>
               <div style={{ fontSize: '0.8rem', fontWeight: 700 }}>{user?.name}</div>
               <div style={{ fontSize: '0.6rem', opacity: 0.5 }}>{user?.type === 'guest' ? 'Guest Explorer' : 'Pro Member'}</div>
            </div>
         </button>
         <button className="btn-action" onClick={onLogout} title="Sign Out">
            <LogOut size={14} />
         </button>
      </div>
    </aside>
  );
}
