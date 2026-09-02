'use client';

import React, { useState } from 'react';
import { useWorkspace } from '@/hooks/use-workspace-context';
import {
  FileText,
  Sparkles,
  Check,
  X,
  Copy,
  Layers,
  ShieldCheck,
  Bug,
  Calendar,
  Eye,
} from 'lucide-react';

interface TemplateDef {
  id: string;
  titleKey: string;
  descKey: string;
  defaultTitle: string;
  emoji: string;
  icon: React.ComponentType<{ className?: string }>;
  tags: string[];
  content: string;
}

const TEMPLATES: TemplateDef[] = [
  {
    id: 'prd',
    titleKey: 'prdTitle',
    descKey: 'prdDesc',
    defaultTitle: 'PRD: Новая функциональность платформы',
    emoji: '📋',
    icon: FileText,
    tags: ['Product', 'Specification', 'Roadmap'],
    content: `# 📋 Product Requirements Document (PRD)

## 1. Обзор и проблема (Problem Statement)
- **Целевая аудитория:** Разработчики и менеджеры проектов в распределенных командах.
- **Текущая проблема:** Сложность синхронизации задач и документов в реальном времени при высокой скорости итераций.
- **Цель продукта:** Предоставить единый высокопроизводительный хаб с синхронизацией по CRDT и нативной поддержкой канбан-досок.

## 2. Цели и Non-Goals
### ✅ Что входит в скоуп (In Scope):
- Совместное редактирование документов с разрешением конфликтов без блокировок (Yjs).
- Отображение присутствия курсоров коллег онлайн.
- Мгновенный экспорт в Markdown и автономный оффлайн-режим.

### ❌ Что НЕ входит в скоуп (Non-Goals):
- Интеграция со сторонними CRM системами на первой фазе.
- Сложный видеостриминг внутри редактора.

## 3. Пользовательские сценарии (User Stories)
1. *Как инженер*, я хочу одновременно с тимлидом редактировать техспеку, чтобы не тратить время на слияние правок.
2. *Как продакт-менеджер*, я хочу связывать задачи со спецификациями, чтобы команда видела полный контекст.

## 4. Требования к производительности (NFR)
- Время синхронизации символа: **< 50ms** при локальной сети.
- Поддержка документов размером до **50 000 слов** без задержек ввода.
- 100% сохранность правок при потере сетевого соединения.

## 5. Метрики успеха (Success KPIs)
- **Time-to-merge specs:** сокращение времени согласования архитектуры на 40%.
- **Weekly Active Editors:** > 80% членов команды еженедельно.
`,
  },
  {
    id: 'adr',
    titleKey: 'rfcTitle',
    descKey: 'rfcDesc',
    defaultTitle: 'ADR-012: Переход на CRDT и Server-Sent Events',
    emoji: '🏛️',
    icon: Layers,
    tags: ['Architecture', 'Backend', 'RFC'],
    content: `# 🏛️ Architecture Decision Record (ADR)

**Статус:** Принято (Accepted)  
**Дата:** 2026-08-29  
**Авторы:** Core Engineering Squad  

---

## 1. Контекст и проблематика
Для совместной работы в Flowspace требовался надёжный механизм многопользовательского редактирования документов и досок задач. 
Традиционные REST polling запросы создавали избыточную нагрузку на серверную инфраструктуру и приводили к конфликтам последних перезаписей (Last Write Wins).

## 2. Рассмотренные альтернативы

### Вариант A: WebSockets (Полный дуплекс)
- **Плюсы:** Низкая задержка, двусторонняя связь.
- **Минусы:** Сложность балансировки через reverse proxy Cloud Run, обрывы соединений в iFrame sandboxes.

### Вариант B: CRDT (Yjs) + Server-Sent Events (SSE) (Выбран)
- **Плюсы:**
  - Автоматическое бесконфликтное слияние веток на клиентах через State Vectors.
  - Нативная совместимость с HTTP/2 streaming в Cloud Run без потери сессий.
  - Поддержка BroadcastChannel для мгновенной синхронизации вкладок одного пользователя.
- **Минусы:** Необходимость сериализации бинарных диффов Yjs в base64 для текстового SSE потока.

## 3. Решение
Принять архитектуру **CRDT + SSE**:
1. Клиент хранит Y.Doc в памяти с привязкой к IndexedDB для оффлайна.
2. Каждое изменение сериализуется в инкрементальный патч и передаётся на сервер.
3. Сервер рассылает обновления подписчикам рабочей области через \`/api/realtime/stream\`.

## 4. Последствия и риски
- Устранена вероятность потери пользовательского контента.
- Повышена отказоустойчивость интерфейса в нестабильных сетях.
`,
  },
  {
    id: 'retro',
    titleKey: 'retroTitle',
    descKey: 'retroDesc',
    defaultTitle: 'Sprint 24: Ретроспектива и план улучшений',
    emoji: '🎯',
    icon: Sparkles,
    tags: ['Agile', 'Retrospective', 'Sprint'],
    content: `# 🎯 Sprint 24: Итоги и Ретроспектива

**Спринт:** Sprint 24 — Performance & Real-time Reliability  
**Запланировано:** 42 Story Points  
**Выполнено:** 38 Story Points  
**Velocity:** 90.4%  

---

## 💚 Что прошло отлично (What Went Well)
- Успешно внедрили Server-Sent Events и снизили пиковый CPU сервера на 28%.
- Все критические баги P0 были закрыты в первые 48 часов спринта.
- Отличная командная координация во время релиза ретроспектив.

## ⚠️ Узкие места и сложности (Bottlenecks)
- Оценки задач по миграции базы данных оказались заниженными (планировали 4ч, ушло 11ч).
- Не хватало автоматических e2e тестов для многопользовательского курсора.

## 🏆 Благодарности коллегам (Kudos)
- **Elena:** За молниеносный фикс бага дедлока в BroadcastChannel.
- **Marcus:** За структурирование документации к API.

## 🚀 План действий (Action Items)
| Действие | Ответственный | Срок | Критерий готовности |
| :--- | :--- | :--- | :--- |
| Настроить Playwright e2e тест для CRDT | Alex Mercer | 2026-09-04 | Зеленый CI pipeline |
| Ввести буфер +20% на задачи инженерии данных | Elena Rostova | Sprint 25 | Обновленный план спринта |
| Подготовить шаблоны документации | Demo Lead | 2026-08-30 | 5 шаблонов в библиотеке |
`,
  },
  {
    id: 'sync',
    titleKey: 'standupNotesTitle',
    descKey: 'standupNotesDesc',
    defaultTitle: 'Протокол еженедельного командного синхрона',
    emoji: '📅',
    icon: Calendar,
    tags: ['Sync', 'Meeting Notes', 'Standup'],
    content: `# 📅 Протокол командного синхрона

**Дата встречи:** 2026-08-29  
**Участники:** Elena Rostova, Marcus Vance, Alex Mercer, Sarah Jenkins, Demo Lead  
**Фасилитатор:** Demo Lead  

---

## 📌 Главная повестка дня
1. Статус закрытия ключевых фич Sprint 24.
2. Архитектура системы уведомлений и персонального фокуса.
3. Подготовка релиза для открытого бета-тестирования.

## 💬 Ключевые тезисы обсуждения
- Команда единогласно поддержала добавление центра уведомлений в верхний хедер.
- Фокус-таймер Pomodoro помогает инженерам логировать время напрямую в канбан-задачи.
- Необходимо экспортировать сводки утреннего стэндапа в Slack/Telegram формат.

## 🚨 Блокеры и зависимости
- *Зависимость:* Ждем согласования нового манифеста и иконок для PWA.
- *Риск:* Нагрузка на память при открытии более 15 вкладок Yjs одновременно.

## 📝 Зафиксированные поручения
- [ ] Опубликовать обновленную сборку на тестовый стейджинг (Отв: Alex)
- [ ] Добавить в канбан экспорт в CSV (Отв: Demo Lead)
`,
  },
  {
    id: 'rca',
    titleKey: 'bugReportTitle',
    descKey: 'bugReportDesc',
    defaultTitle: 'Post-Mortem: Инцидент INC-104 (SSE Stream Reconnect)',
    emoji: '🐛',
    icon: Bug,
    tags: ['Post-Mortem', 'Incident', 'Security'],
    content: `# 🐛 Post-Mortem & Анализ инцидента (RCA)

**Идентификатор:** INC-104  
**Уровень критичности:** P1 (High Impact)  
**Дата инцидента:** 2026-08-28  
**Время простоя (Downtime):** 14 минут  

---

## 1. Краткое резюме инцидента
В 14:20 UTC пользователи заметили периодические переподключения потока реального времени с индикатором «Reconnecting».
Затронуто порядка 18% активных сессий воркспейса.

## 2. Хронология событий (Timeline)
- **14:20:** Сработал алерт по росту 504 Gateway Timeout на роуте \`/api/realtime/stream\`.
- **14:25:** Инженеры определили, что upstream прокси разрывал соединения ровно через 60 секунд.
- **14:31:** Развернут hotfix с отправкой keep-alive комментария \`: ping\` каждые 15 секунд.
- **14:34:** Соединения стабилизированы, метрики ошибок упали до 0.

## 3. Анализ первопричины (Метод 5 Whys)
1. *Почему происходили дисконнекты?* — Прокси-сервер закрывал неактивные HTTP соединения.
2. *Почему соединение считалось неактивным?* — При отсутствии новых событий задач в стрим не передавались байты.
3. *Почему не было heartbeat?* — Интервал пинга был установлен на 90с вместо 15с.

## 4. Превентивные меры (Preventive Actions)
- [x] Уменьшить интервал heartbeat до 15 секунд.
- [ ] Добавить автоматический интеграционный мониторинг для проверки живости SSE.
- [ ] Добавить экспоненциальную задержку повторного подключения на клиенте.
`,
  },
];

interface TemplatesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTemplate: (template: TemplateDef) => void;
}

export function TemplatesModal({ isOpen, onClose, onSelectTemplate }: TemplatesModalProps) {
  const { t } = useWorkspace();
  const [selectedId, setSelectedId] = useState<string>('prd');

  if (!isOpen) return null;

  const current = TEMPLATES.find((t) => t.id === selectedId) || TEMPLATES[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-neutral-900 border border-neutral-800 rounded-3xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="p-5 border-b border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-neutral-100">{t.templates.title}</h2>
              <p className="text-xs text-neutral-400 mt-0.5">{t.templates.subtitle}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body: Left list + Right preview */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          {/* Left Column: Template Cards */}
          <div className="w-full md:w-80 border-r border-neutral-800/80 p-3 space-y-2 overflow-y-auto custom-scrollbar bg-neutral-950/40">
            {TEMPLATES.map((tmpl) => {
              const isSelected = tmpl.id === selectedId;
              const Icon = tmpl.icon;
              const title = (t.templates as any)[tmpl.titleKey] || tmpl.defaultTitle;
              const desc = (t.templates as any)[tmpl.descKey] || '';

              return (
                <div
                  key={tmpl.id}
                  onClick={() => setSelectedId(tmpl.id)}
                  className={`p-3 rounded-2xl cursor-pointer transition-all border ${
                    isSelected
                      ? 'bg-indigo-950/40 border-indigo-500/40 shadow-sm'
                      : 'bg-neutral-900/40 border-neutral-800/80 hover:bg-neutral-850 hover:border-neutral-700'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-xl">{tmpl.emoji}</span>
                    <div className="min-w-0 flex-1">
                      <h4
                        className={`text-xs font-bold truncate ${
                          isSelected ? 'text-indigo-200' : 'text-neutral-200'
                        }`}
                      >
                        {title}
                      </h4>
                      <p className="text-3xs text-neutral-400 mt-0.5 line-clamp-1">{desc}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 mt-2.5 flex-wrap">
                    {tmpl.tags.map((tag) => (
                      <span
                        key={tag}
                        className="text-3xs font-medium px-1.5 py-0.2 rounded-md bg-neutral-800 text-neutral-400"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right Column: Template Content Preview */}
          <div className="flex-1 flex flex-col bg-neutral-950/80 overflow-hidden">
            <div className="p-3.5 border-b border-neutral-800/80 flex items-center justify-between bg-neutral-900/40">
              <div className="flex items-center gap-2">
                <span className="text-lg">{current.emoji}</span>
                <span className="text-xs font-bold text-neutral-200">{current.defaultTitle}</span>
              </div>
              <span className="text-3xs text-neutral-500 font-mono">
                {current.content.split('\n').length} строк
              </span>
            </div>

            <div className="flex-1 p-4 overflow-y-auto custom-scrollbar font-mono text-2xs text-neutral-300 whitespace-pre-wrap leading-relaxed">
              {current.content}
            </div>

            {/* Footer action */}
            <div className="p-4 border-t border-neutral-800 bg-neutral-900/60 flex items-center justify-between">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 transition-colors"
              >
                {t.common.cancel}
              </button>
              <button
                onClick={() => {
                  onSelectTemplate(current);
                  onClose();
                }}
                className="flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors shadow-lg shadow-indigo-600/20"
              >
                <Check className="w-4 h-4" />
                <span>{t.templates.useTemplate}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
