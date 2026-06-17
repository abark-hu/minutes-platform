const { useState, useEffect } = React;

const DARK = '#473530';
const TAN = '#CEB69F';
const CREAM = '#F5EDE3';

const EMAILJS_SERVICE = 'service_6qu38r5';
const EMAILJS_TEMPLATE_MINUTES = 'template_wtrgzpq';
const EMAILJS_TEMPLATE_TASKS = 'template_5d8v3c4';
const EMAILJS_PUBLIC_KEY = 'XJGXMwDyEcfgCiyHb';

const emptyParticipant = () => ({ id: Date.now() + Math.random(), name: '', email: '', task: '' });
const emptyAgendaItem = () => ({ id: Date.now() + Math.random(), topic: '', recommendations: '' });

const sendEmail = (templateId, params) => {
  return emailjs.send(EMAILJS_SERVICE, templateId, params);
};

const buildAgendaContent = (items) => {
  return items.filter(a => a.topic.trim()).map((item, idx) => {
    let text = `${idx + 1}. ${item.topic}`;
    if (item.recommendations.trim()) {
      const recs = item.recommendations.split('\n').filter(l => l.trim());
      text += '\nالتوصيات:\n' + recs.map(r => `- ${r.replace(/^[-•\d.\)]+\s*/, '')}`).join('\n');
    }
    return text;
  }).join('\n\n');
};

function App() {
  const [minutes, setMinutes] = useState(() => {
    try { return JSON.parse(localStorage.getItem('rasf-minutes') || '[]'); } catch { return []; }
  });
  const [view, setView] = useState('list');
  const [selected, setSelected] = useState(null);
  const [expandedItems, setExpandedItems] = useState({});
  const [sending, setSending] = useState(false);
  const [sendStatus, setSendStatus] = useState('');

  const [title, setTitle] = useState('');
  const [meetingDate, setMeetingDate] = useState('');
  const [location, setLocation] = useState('');
  const [content, setContent] = useState('');
  const [fileName, setFileName] = useState('');
  const [agendaItems, setAgendaItems] = useState([emptyAgendaItem()]);
  const [participants, setParticipants] = useState([emptyParticipant()]);

  useEffect(() => {
    emailjs.init({ publicKey: EMAILJS_PUBLIC_KEY });
  }, []);

  const persist = (list) => {
    localStorage.setItem('rasf-minutes', JSON.stringify(list));
  };

  const addParticipant = () => setParticipants([...participants, emptyParticipant()]);
  const removeParticipant = (id) => setParticipants(participants.filter(p => p.id !== id));
  const updateParticipant = (id, f, v) => setParticipants(participants.map(p => p.id === id ? { ...p, [f]: v } : p));
  const addAgendaItem = () => setAgendaItems([...agendaItems, emptyAgendaItem()]);
  const removeAgendaItem = (id) => setAgendaItems(agendaItems.filter(a => a.id !== id));
  const updateAgendaItem = (id, f, v) => setAgendaItems(agendaItems.map(a => a.id === id ? { ...a, [f]: v } : a));

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (file) { setFileName(file.name); setContent(prev => prev || `تم رفع الملف: ${file.name}`); }
  };

  const saveMinute = () => {
    if (!title.trim()) return;
    const newMinute = {
      id: Date.now(), title, meetingDate, location, content, fileName,
      agendaItems: agendaItems.filter(a => a.topic.trim()),
      participants: participants.filter(p => p.name.trim() || p.email.trim()),
      createdAt: new Date().toISOString(),
      approvals: {}, minuteSent: false,
    };
    const updated = [newMinute, ...minutes];
    setMinutes(updated); persist(updated);
    resetForm(); setSelected(newMinute); setView('detail');
  };

  const resetForm = () => {
    setTitle(''); setMeetingDate(''); setLocation(''); setContent(''); setFileName('');
    setAgendaItems([emptyAgendaItem()]); setParticipants([emptyParticipant()]);
  };

  const sendMinuteToAll = async (minute) => {
    setSending(true); setSendStatus('');
    try {
      const agendaContent = buildAgendaContent(minute.agendaItems || []);
      for (const p of (minute.participants || []).filter(p => p.email.trim())) {
        await sendEmail(EMAILJS_TEMPLATE_MINUTES, {
          to_email: p.email, to_name: p.name || 'المشارك',
          minute_title: minute.title, meeting_date: minute.meetingDate || 'غير محدد',
          location: minute.location || 'غير محدد', agenda_content: agendaContent || 'لا توجد محاور',
        });
      }
      const updated = minutes.map(m => m.id === minute.id ? { ...m, minuteSent: true } : m);
      setMinutes(updated); persist(updated);
      setSelected(updated.find(m => m.id === minute.id));
      setSendStatus('success');
    } catch (e) { setSendStatus('error'); }
    setSending(false);
  };

  const toggleApproval = async (minuteId, participantId) => {
    const minute = minutes.find(m => m.id === minuteId);
    const wasApproved = minute?.approvals?.[participantId];
    const updated = minutes.map(m => m.id !== minuteId ? m : { ...m, approvals: { ...m.approvals, [participantId]: !wasApproved } });
    setMinutes(updated); persist(updated);
    const updatedMinute = updated.find(m => m.id === minuteId);
    if (selected?.id === minuteId) setSelected(updatedMinute);
    if (!wasApproved) {
      const p = minute.participants.find(p => p.id === participantId);
      if (p?.email) {
        try {
          await sendEmail(EMAILJS_TEMPLATE_TASKS, {
            to_email: p.email, to_name: p.name || 'المشارك',
            minute_title: minute.title, meeting_date: minute.meetingDate || 'غير محدد',
            task: p.task || 'لا توجد مهمة محددة',
          });
        } catch (e) { console.error('فشل إرسال المهمة', e); }
      }
    }
  };

  const deleteMinute = (id) => {
    const updated = minutes.filter(m => m.id !== id);
    setMinutes(updated); persist(updated);
    if (selected?.id === id) { setSelected(null); setView('list'); }
  };

  const approvalCount = (m) => Object.values(m.approvals || {}).filter(Boolean).length;
  const totalP = (m) => (m.participants || []).length;
  const isFullyApproved = (m) => totalP(m) > 0 && approvalCount(m) === totalP(m);
  const toggleExpand = (id) => setExpandedItems(prev => ({ ...prev, [id]: !prev[id] }));

  const inp = "w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1";
  const inpStyle = { borderColor: '#eaddd1', outlineColor: TAN };

  return (
    <div style={{ minHeight: '100vh', background: CREAM, fontFamily: 'Tahoma, Arial, sans-serif' }} dir="rtl">
      {/* Header */}
      <div style={{ background: DARK, padding: '20px 24px', boxShadow: '0 2px 8px rgba(0,0,0,0.2)' }}>
        <div style={{ maxWidth: 900, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ background: TAN, borderRadius: 8, padding: 8 }}>
              <svg width="24" height="24" fill="none" stroke={DARK} strokeWidth="2" viewBox="0 0 24 24">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14,2 14,8 20,8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10,9 9,9 8,9"/>
              </svg>
            </div>
            <div>
              <div style={{ color: CREAM, fontWeight: 'bold', fontSize: 18 }}>منصة محاضر الاجتماعات</div>
              <div style={{ color: TAN, fontSize: 13 }}>رفع، توقيع، وتوزيع المهام تلقائياً</div>
            </div>
          </div>
          {view !== 'list' && (
            <button onClick={() => { setView('list'); setSelected(null); resetForm(); setSendStatus(''); }}
              style={{ background: 'rgba(255,255,255,0.12)', color: CREAM, border: 'none', borderRadius: 8, padding: '8px 14px', cursor: 'pointer', fontSize: 13 }}>
              ✕ إغلاق
            </button>
          )}
        </div>
      </div>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 16px' }}>

        {/* LIST */}
        {view === 'list' && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div style={{ fontWeight: 'bold', fontSize: 16, color: DARK }}>المحاضر المحفوظة ({minutes.length})</div>
              <button onClick={() => setView('new')}
                style={{ background: DARK, color: CREAM, border: 'none', borderRadius: 8, padding: '10px 18px', cursor: 'pointer', fontSize: 13, fontWeight: 'bold' }}>
                + إضافة محضر جديد
              </button>
            </div>
            {minutes.length === 0 ? (
              <div style={{ background: '#fff', borderRadius: 12, border: `1px solid ${TAN}`, padding: 40, textAlign: 'center', color: '#a89a8c' }}>
                لا توجد محاضر مضافة بعد.
              </div>
            ) : minutes.map(m => (
              <div key={m.id} style={{ background: '#fff', borderRadius: 12, border: '1px solid #eaddd1', padding: '14px 16px', marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => { setSelected(m); setView('detail'); setSendStatus(''); }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                    <span style={{ fontWeight: 'bold', color: DARK }}>{m.title}</span>
                    {!m.minuteSent && <span style={{ fontSize: 11, background: '#e8f0fe', color: '#3b5bdb', borderRadius: 20, padding: '2px 8px' }}>لم يُرسل بعد</span>}
                    {m.minuteSent && isFullyApproved(m) && <span style={{ fontSize: 11, background: '#d1fae5', color: '#065f46', borderRadius: 20, padding: '2px 8px' }}>✓ معتمد بالكامل</span>}
                    {m.minuteSent && !isFullyApproved(m) && <span style={{ fontSize: 11, background: '#f3e7d8', color: '#8a6f4e', borderRadius: 20, padding: '2px 8px' }}>بانتظار الاعتماد ({approvalCount(m)}/{totalP(m)})</span>}
                  </div>
                  <div style={{ fontSize: 12, color: '#a89a8c' }}>
                    {m.meetingDate || 'بدون تاريخ'}{m.location ? ` · ${m.location}` : ''} · {(m.agendaItems||[]).length} محاور · {totalP(m)} مشارك
                  </div>
                </div>
                <button onClick={() => deleteMinute(m.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ccc', fontSize: 18, marginRight: 8 }}>🗑</button>
              </div>
            ))}
          </>
        )}

        {/* NEW */}
        {view === 'new' && (
          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #eaddd1', padding: 24 }}>
            <div style={{ fontWeight: 'bold', fontSize: 16, color: DARK, marginBottom: 20 }}>إضافة محضر جديد</div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 'bold', color: DARK, marginBottom: 4 }}>عنوان المحضر *</label>
                <input className={inp} style={inpStyle} value={title} onChange={e => setTitle(e.target.value)} placeholder="محضر اجتماع مجلس الإدارة" />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 'bold', color: DARK, marginBottom: 4 }}>تاريخ الاجتماع</label>
                <input type="date" className={inp} style={inpStyle} value={meetingDate} onChange={e => setMeetingDate(e.target.value)} />
              </div>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 'bold', color: DARK, marginBottom: 4 }}>المكان</label>
              <input className={inp} style={inpStyle} value={location} onChange={e => setLocation(e.target.value)} placeholder="قاعة الاجتماعات الرئيسية" />
            </div>

            {/* Agenda */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <label style={{ fontSize: 13, fontWeight: 'bold', color: DARK }}>المحاور والتوصيات</label>
                <button onClick={addAgendaItem} style={{ background: '#f3e7d8', color: DARK, border: 'none', borderRadius: 6, padding: '6px 12px', cursor: 'pointer', fontSize: 12 }}>+ إضافة محور</button>
              </div>
              {agendaItems.map((item, idx) => (
                <div key={item.id} style={{ borderRadius: 10, border: '1px solid #eaddd1', overflow: 'hidden', marginBottom: 10 }}>
                  <div style={{ background: DARK, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ background: TAN, color: DARK, borderRadius: '50%', width: 24, height: 24, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 'bold', flexShrink: 0 }}>{idx + 1}</span>
                    <input value={item.topic} onChange={e => updateAgendaItem(item.id, 'topic', e.target.value)}
                      placeholder="عنوان المحور..." style={{ flex: 1, background: 'transparent', border: 'none', color: CREAM, fontSize: 13, outline: 'none' }} />
                    {agendaItems.length > 1 && <button onClick={() => removeAgendaItem(item.id)} style={{ background: 'none', border: 'none', color: '#aaa', cursor: 'pointer', fontSize: 16 }}>✕</button>}
                  </div>
                  <div style={{ background: '#faf5ef', padding: '10px 14px' }}>
                    <label style={{ fontSize: 12, color: '#8a6f4e', display: 'block', marginBottom: 6 }}>التوصيات (كل توصية في سطر)</label>
                    <textarea value={item.recommendations} onChange={e => updateAgendaItem(item.id, 'recommendations', e.target.value)}
                      rows={3} placeholder="اكتب توصيات هذا المحور..."
                      style={{ width: '100%', border: '1px solid #eaddd1', borderRadius: 6, padding: '8px 10px', fontSize: 13, resize: 'none', outline: 'none', background: '#fff', color: DARK }} />
                  </div>
                </div>
              ))}
            </div>

            {/* File */}
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 'bold', color: DARK, marginBottom: 4 }}>رفع ملف (اختياري)</label>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, border: `1px dashed ${TAN}`, borderRadius: 8, padding: '8px 14px', cursor: 'pointer', fontSize: 13, color: '#a89a8c' }}>
                📎 {fileName || 'اختر ملف'}
                <input type="file" onChange={handleFile} style={{ display: 'none' }} />
              </label>
            </div>

            {/* Notes */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 'bold', color: DARK, marginBottom: 4 }}>ملاحظات إضافية</label>
              <textarea value={content} onChange={e => setContent(e.target.value)} rows={3}
                style={{ width: '100%', border: '1px solid #eaddd1', borderRadius: 8, padding: '10px 12px', fontSize: 13, resize: 'none', outline: 'none', color: DARK }} />
            </div>

            {/* Participants */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <label style={{ fontSize: 13, fontWeight: 'bold', color: DARK }}>المشاركون والمهام</label>
                <button onClick={addParticipant} style={{ background: '#f3e7d8', color: DARK, border: 'none', borderRadius: 6, padding: '6px 12px', cursor: 'pointer', fontSize: 12 }}>+ إضافة مشارك</button>
              </div>
              {participants.map(p => (
                <div key={p.id} style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr 1.5fr auto', gap: 8, background: CREAM, border: '1px solid #eaddd1', borderRadius: 8, padding: 10, marginBottom: 8 }}>
                  <input placeholder="الاسم" value={p.name} onChange={e => updateParticipant(p.id, 'name', e.target.value)}
                    style={{ border: '1px solid #eaddd1', borderRadius: 6, padding: '6px 10px', fontSize: 13, outline: 'none', background: '#fff' }} />
                  <input type="email" placeholder="البريد" value={p.email} onChange={e => updateParticipant(p.id, 'email', e.target.value)}
                    style={{ border: '1px solid #eaddd1', borderRadius: 6, padding: '6px 10px', fontSize: 13, outline: 'none', background: '#fff' }} />
                  <input placeholder="المهمة المطلوبة" value={p.task} onChange={e => updateParticipant(p.id, 'task', e.target.value)}
                    style={{ border: '1px solid #eaddd1', borderRadius: 6, padding: '6px 10px', fontSize: 13, outline: 'none', background: '#fff' }} />
                  {participants.length > 1 && <button onClick={() => removeParticipant(p.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ccc', fontSize: 16 }}>✕</button>}
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button onClick={() => { setView('list'); resetForm(); }}
                style={{ border: '1px solid #eaddd1', background: '#fff', color: '#a89a8c', borderRadius: 8, padding: '10px 18px', cursor: 'pointer', fontSize: 13 }}>إلغاء</button>
              <button onClick={saveMinute} disabled={!title.trim()}
                style={{ background: title.trim() ? DARK : '#ccc', color: CREAM, border: 'none', borderRadius: 8, padding: '10px 22px', cursor: title.trim() ? 'pointer' : 'not-allowed', fontSize: 13, fontWeight: 'bold' }}>
                حفظ المحضر
              </button>
            </div>
          </div>
        )}

        {/* DETAIL */}
        {view === 'detail' && selected && (
          <div>
            {/* Info */}
            <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #eaddd1', padding: 20, marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontWeight: 'bold', fontSize: 17, color: DARK }}>{selected.title}</div>
                  <div style={{ fontSize: 13, color: '#a89a8c', marginTop: 6, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                    {selected.meetingDate && <span>📅 {selected.meetingDate}</span>}
                    {selected.location && <span>📍 {selected.location}</span>}
                    <span>👥 {totalP(selected)} مشارك</span>
                    <span>📋 {(selected.agendaItems||[]).length} محاور</span>
                  </div>
                </div>
                {isFullyApproved(selected)
                  ? <span style={{ fontSize: 12, background: '#d1fae5', color: '#065f46', borderRadius: 20, padding: '4px 12px' }}>✓ معتمد بالكامل</span>
                  : <span style={{ fontSize: 12, background: '#f3e7d8', color: '#8a6f4e', borderRadius: 20, padding: '4px 12px' }}>{approvalCount(selected)}/{totalP(selected)} اعتمدوا</span>}
              </div>

              <div style={{ borderTop: '1px solid #eaddd1', marginTop: 14, paddingTop: 14 }}>
                {!selected.minuteSent ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <button onClick={() => sendMinuteToAll(selected)} disabled={sending}
                      style={{ background: sending ? '#aaa' : DARK, color: CREAM, border: 'none', borderRadius: 8, padding: '10px 18px', cursor: sending ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 'bold' }}>
                      {sending ? 'جاري الإرسال...' : '📤 إرسال المحضر للمشاركين'}
                    </button>
                    {sendStatus === 'error' && <span style={{ color: 'red', fontSize: 12 }}>فشل الإرسال، تحقق من الاتصال</span>}
                  </div>
                ) : (
                  <div style={{ color: '#059669', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                    ✓ تم إرسال المحضر لجميع المشاركين — بانتظار اعتمادهم
                    {sendStatus === 'success' && <span style={{ fontSize: 11 }}> (تم الإرسال الآن)</span>}
                  </div>
                )}
              </div>
            </div>

            {/* Agenda */}
            {(selected.agendaItems||[]).length > 0 && (
              <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #eaddd1', overflow: 'hidden', marginBottom: 16 }}>
                <div style={{ background: DARK, padding: '12px 20px' }}>
                  <span style={{ color: CREAM, fontWeight: 'bold', fontSize: 14 }}>المحاور والتوصيات</span>
                </div>
                {selected.agendaItems.map((item, idx) => (
                  <div key={item.id} style={{ borderBottom: '1px solid #eaddd1' }}>
                    <button onClick={() => toggleExpand(item.id)}
                      style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'right' }}>
                      <span style={{ background: TAN, color: DARK, borderRadius: '50%', width: 28, height: 28, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 'bold', flexShrink: 0 }}>{idx + 1}</span>
                      <span style={{ flex: 1, fontWeight: 'bold', fontSize: 14, color: DARK }}>{item.topic}</span>
                      <span style={{ fontSize: 11, background: '#f3e7d8', color: '#8a6f4e', borderRadius: 20, padding: '2px 8px', flexShrink: 0 }}>
                        {item.recommendations ? item.recommendations.split('\n').filter(l => l.trim()).length : 0} توصيات
                      </span>
                      <span style={{ color: '#a89a8c', fontSize: 16 }}>{expandedItems[item.id] ? '▲' : '▼'}</span>
                    </button>
                    {expandedItems[item.id] && item.recommendations && (
                      <div style={{ background: '#faf5ef', padding: '12px 20px 16px' }}>
                        <div style={{ fontSize: 12, color: '#8a6f4e', marginBottom: 8, fontWeight: 'bold' }}>التوصيات:</div>
                        {item.recommendations.split('\n').filter(l => l.trim()).map((rec, i) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, background: '#fff', borderRight: `4px solid ${TAN}`, borderRadius: 6, padding: '8px 12px', marginBottom: 6, fontSize: 13, color: DARK }}>
                            <span style={{ color: TAN, marginTop: 1 }}>✓</span>
                            <span>{rec.replace(/^[-•\d.\)]+\s*/, '')}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Notes */}
            {selected.content && (
              <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #eaddd1', padding: 20, marginBottom: 16 }}>
                <div style={{ fontWeight: 'bold', color: DARK, marginBottom: 8, fontSize: 14 }}>ملاحظات إضافية</div>
                <div style={{ fontSize: 13, color: '#6b5a52', whiteSpace: 'pre-wrap', lineHeight: 1.8 }}>{selected.content}</div>
              </div>
            )}

            {/* Approval */}
            <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #eaddd1', overflow: 'hidden' }}>
              <div style={{ background: DARK, padding: '12px 20px' }}>
                <span style={{ color: CREAM, fontWeight: 'bold', fontSize: 14 }}>المشاركون والاعتماد</span>
              </div>
              {(selected.participants || []).map(p => {
                const approved = selected.approvals?.[p.id];
                return (
                  <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', borderBottom: '1px solid #eaddd1', background: approved ? '#f0fdf4' : '#fff' }}>
                    <div>
                      <div style={{ fontWeight: 'bold', fontSize: 14, color: DARK }}>{p.name || '(بدون اسم)'}</div>
                      <div style={{ fontSize: 12, color: '#a89a8c', marginTop: 2 }}>✉ {p.email || 'لا يوجد بريد'}</div>
                      {p.task && <div style={{ fontSize: 12, color: '#8a6f4e', marginTop: 3 }}>المهمة: {p.task}</div>}
                    </div>
                    <button onClick={() => toggleApproval(selected.id, p.id)}
                      style={{ background: approved ? '#059669' : '#f3e7d8', color: approved ? '#fff' : DARK, border: 'none', borderRadius: 8, padding: '8px 14px', cursor: 'pointer', fontSize: 12, fontWeight: 'bold' }}>
                      {approved ? '✓ تم الاعتماد' : 'اعتماد المحضر'}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
