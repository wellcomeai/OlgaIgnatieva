"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, Loader2, Plus, ShieldCheck, Trash2, X, XCircle } from "lucide-react";

import { botsApi } from "@/api/bots";
import type { ChannelCheck } from "@/types";

import { CopyButton } from "@/components/ui/copy-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { FlowButton, FlowNodeData } from "@/types";
import { BLOCKS, TRIGGER_KINDS, UNITS } from "./blocks";
import { useEditor } from "./context";
import { newId, type FlowNode } from "./graph";

const selectCls = "h-10 w-full rounded-md border border-input bg-background px-3 text-sm";

const VAR_PRESETS = [
  { value: "email", label: "Email", validate: "email" },
  { value: "phone", label: "Телефон", validate: "phone" },
  { value: "name", label: "Имя", validate: "any" },
  { value: "answer", label: "Свободный ответ", validate: "any" },
] as const;

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
      {hint && <p className="text-xs text-[#8e8e93]">{hint}</p>}
    </div>
  );
}

function ProductSelect({ value, onChange }: { value?: string | null; onChange: (v: string) => void }) {
  const { products } = useEditor();
  if (products.length === 0) {
    return (
      <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
        Пока нет продуктов.{" "}
        <Link href="/products" target="_blank" className="font-semibold underline">
          Создайте продукт
        </Link>
        , затем вернитесь сюда.
      </p>
    );
  }
  return (
    <select className={selectCls} value={value ?? ""} onChange={(e) => onChange(e.target.value)}>
      <option value="" disabled>
        Выберите продукт
      </option>
      {products.map((p) => (
        <option key={p.id} value={p.id}>
          {p.title} — {Number(p.price).toLocaleString("ru-RU")} ₽{p.is_active ? "" : " (снят с продажи)"}
        </option>
      ))}
    </select>
  );
}

function TextWithPlaceholders({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div className="space-y-1.5">
      <Textarea rows={6} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      <div className="flex flex-wrap gap-1">
        {[
          ["{first_name}", "+ Имя"],
          ["<b></b>", "+ Жирный"],
        ].map(([token, label]) => (
          <button
            key={token}
            type="button"
            onClick={() => onChange(value + token)}
            className="rounded-full bg-[rgba(6,157,223,0.1)] px-2.5 py-1 text-xs font-medium text-[#2B2E81] hover:bg-[rgba(6,157,223,0.18)]"
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

function ChannelField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { botId, botUsername } = useEditor();
  const [result, setResult] = useState<ChannelCheck | null>(null);
  const [checking, setChecking] = useState(false);

  async function check() {
    setChecking(true);
    try {
      setResult(await botsApi.channelCheck(botId, value));
    } catch {
      setResult({ ok: false, error: "Не удалось проверить — попробуйте ещё раз" });
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="space-y-3">
      <Field label="Канал" hint="Публичная ссылка https://t.me/имя_канала или @имя_канала">
        <Input
          value={value}
          placeholder="https://t.me/visanewstoyou"
          onChange={(e) => {
            onChange(e.target.value);
            setResult(null);
          }}
        />
      </Field>
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-900">
        <div className="mb-1 flex items-center gap-1.5 font-semibold">
          <AlertTriangle className="h-3.5 w-3.5" /> Чтобы проверка работала
        </div>
        Добавьте бота{botUsername ? <b> @{botUsername}</b> : ""} <b>администратором канала</b>: канал → Управление
        каналом → Администраторы → Добавить администратора. Никакие права, кроме самого статуса, не нужны. Без этого
        Telegram не скажет боту, подписан ли человек, — и все пойдут по ветке «Нет».
      </div>
      <button
        type="button"
        onClick={check}
        disabled={!value.trim() || checking}
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-black/[0.1] py-2 text-sm font-medium text-[#2B2E81] hover:bg-[rgba(6,157,223,0.06)] disabled:opacity-50"
      >
        {checking ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
        Проверить доступ бота
      </button>
      {result && (
        <div
          className={cn(
            "flex items-start gap-2 rounded-lg p-3 text-xs",
            result.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700",
          )}
        >
          {result.ok ? <CheckCircle2 className="mt-px h-4 w-4 shrink-0" /> : <XCircle className="mt-px h-4 w-4 shrink-0" />}
          <span>
            {result.ok ? (
              <>
                Всё готово: бот — администратор канала <b>«{result.title}»</b> и сможет проверять подписку.
              </>
            ) : (
              <>
                {result.title && (
                  <>
                    Канал <b>«{result.title}»</b> найден. <br />
                  </>
                )}
                {result.error}
              </>
            )}
          </span>
        </div>
      )}
    </div>
  );
}

function ButtonsEditor({ buttons, onChange }: { buttons: FlowButton[]; onChange: (b: FlowButton[]) => void }) {
  const update = (i: number, patch: Partial<FlowButton>) =>
    onChange(buttons.map((b, j) => (j === i ? { ...b, ...patch } : b)));
  return (
    <div className="space-y-2">
      {buttons.map((b, i) => (
        <div key={b.id} className="space-y-2 rounded-xl border border-black/[0.08] p-2.5">
          <div className="flex items-center gap-1.5">
            <div className="flex rounded-lg bg-black/[0.04] p-0.5 text-xs">
              {(["next", "url"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => update(i, { type: t })}
                  className={cn(
                    "rounded-md px-2 py-1 font-medium",
                    b.type === t ? "bg-white text-[#2B2E81] shadow-sm" : "text-[#8e8e93]",
                  )}
                >
                  {t === "next" ? "Ветка" : "Ссылка"}
                </button>
              ))}
            </div>
            <div className="flex-1" />
            <button
              type="button"
              aria-label="Удалить кнопку"
              onClick={() => onChange(buttons.filter((_, j) => j !== i))}
              className="rounded p-1 text-[#8e8e93] hover:bg-red-50 hover:text-red-600"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <Input placeholder="Текст кнопки" maxLength={64} value={b.text} onChange={(e) => update(i, { text: e.target.value })} />
          {b.type === "url" && (
            <Input placeholder="https://…" value={b.url ?? ""} onChange={(e) => update(i, { url: e.target.value })} />
          )}
        </div>
      ))}
      {buttons.length < 8 && (
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => onChange([...buttons, { id: newId("b").slice(2), type: "next", text: "" }])}
            className="flex items-center justify-center gap-1 rounded-lg border border-dashed border-black/[0.15] py-2 text-xs font-medium text-[#636366] hover:border-[#069DDF] hover:text-[#2B2E81]"
          >
            <Plus className="h-3.5 w-3.5" /> Кнопка-ветка
          </button>
          <button
            type="button"
            onClick={() => onChange([...buttons, { id: newId("b").slice(2), type: "url", text: "", url: "" }])}
            className="flex items-center justify-center gap-1 rounded-lg border border-dashed border-black/[0.15] py-2 text-xs font-medium text-[#636366] hover:border-[#069DDF] hover:text-[#2B2E81]"
          >
            <Plus className="h-3.5 w-3.5" /> Кнопка-ссылка
          </button>
        </div>
      )}
      <p className="text-xs text-[#8e8e93]">
        У каждой кнопки-ветки свой выход на схеме — соедините его со следующим шагом. Без веток сообщение
        сразу переходит дальше.
      </p>
    </div>
  );
}

export function Inspector({
  node,
  onChange,
  onDelete,
  onClose,
}: {
  node: FlowNode;
  onChange: (data: FlowNodeData) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const { botUsername } = useEditor();
  const spec = BLOCKS[node.type as keyof typeof BLOCKS];
  const Icon = spec.icon;
  const d = node.data;
  const set = (patch: Partial<FlowNodeData>) => onChange({ ...d, ...patch });

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2.5 border-b border-black/[0.06] px-5 py-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-full text-white" style={{ background: spec.color }}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold">{spec.label}</div>
          <div className="truncate text-xs text-[#8e8e93]">{spec.hint}</div>
        </div>
        <button type="button" onClick={onClose} aria-label="Закрыть" className="rounded p-1 text-[#8e8e93] hover:bg-black/[0.05]">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
        {node.type === "trigger" && (
          <>
            <Field label="Когда запускать">
              <div className="space-y-1.5">
                {TRIGGER_KINDS.map((k) => (
                  <label
                    key={k.value}
                    className={cn(
                      "flex cursor-pointer items-start gap-2.5 rounded-xl border px-3 py-2.5",
                      d.kind === k.value ? "border-[#10B981] bg-emerald-50/50" : "border-black/[0.08]",
                    )}
                  >
                    <input
                      type="radio"
                      className="mt-0.5 accent-[#10B981]"
                      checked={d.kind === k.value}
                      onChange={() => set({ kind: k.value, value: "" })}
                    />
                    <span>
                      <span className="block text-sm font-medium">{k.label}</span>
                      <span className="block text-xs text-[#8e8e93]">{k.hint}</span>
                    </span>
                  </label>
                ))}
              </div>
            </Field>
            {d.kind === "start_label" && (
              <Field label="Метка" hint="Латиница, цифры, _ и -">
                <Input
                  value={d.value ?? ""}
                  placeholder="reels"
                  onChange={(e) => set({ value: e.target.value.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 64) })}
                />
                {d.value && botUsername && (
                  <div className="mt-2 flex items-center gap-1 rounded-lg bg-black/[0.03] px-2.5 py-1.5">
                    <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-[#2B2E81]">
                      t.me/{botUsername}?start={d.value}
                    </span>
                    <CopyButton value={`https://t.me/${botUsername}?start=${d.value}`} message="Ссылка скопирована" />
                  </div>
                )}
              </Field>
            )}
            {d.kind === "keyword" && (
              <Field label="Ключевое слово" hint="Сработает, если слово есть в сообщении (регистр не важен)">
                <Input value={d.value ?? ""} maxLength={64} placeholder="гайд" onChange={(e) => set({ value: e.target.value })} />
              </Field>
            )}
            {d.kind === "purchase" && (
              <Field label="Продукт" hint="Воронка запустится сразу после выдачи файлов">
                <ProductSelect value={d.value} onChange={(v) => set({ value: v })} />
              </Field>
            )}
          </>
        )}

        {node.type === "message" && (
          <>
            <Field label="Текст">
              <TextWithPlaceholders value={d.text ?? ""} placeholder="Здравствуйте, {first_name}!" onChange={(v) => set({ text: v })} />
            </Field>
            <Field label="Кнопки">
              <ButtonsEditor buttons={d.buttons ?? []} onChange={(buttons) => set({ buttons })} />
            </Field>
          </>
        )}

        {node.type === "delay" && (
          <Field label="Подождать" hint="От 1 минуты до 90 дней. Отсчёт идёт с момента, когда человек дошёл до паузы.">
            <div className="flex gap-2">
              <Input
                type="number"
                min={1}
                className="w-24"
                value={d.amount ?? 1}
                onChange={(e) => set({ amount: Math.max(1, Math.floor(Number(e.target.value) || 1)) })}
              />
              <select className={selectCls} value={d.unit ?? "hours"} onChange={(e) => set({ unit: e.target.value as FlowNodeData["unit"] })}>
                {UNITS.map((u) => (
                  <option key={u.value} value={u.value}>
                    {u.label}
                  </option>
                ))}
              </select>
            </div>
          </Field>
        )}

        {node.type === "question" && (
          <>
            <Field label="Вопрос">
              <TextWithPlaceholders value={d.text ?? ""} placeholder="Напишите ваш email:" onChange={(v) => set({ text: v })} />
            </Field>
            <Field label="Что сохраняем" hint="Ответ появится в карточке подписчика. Бот попросит повторить, если формат неверный.">
              <select
                className={selectCls}
                value={VAR_PRESETS.find((p) => p.value === d.var)?.value ?? "answer"}
                onChange={(e) => {
                  const p = VAR_PRESETS.find((x) => x.value === e.target.value)!;
                  set({ var: p.value, validate: p.validate });
                }}
              >
                {VAR_PRESETS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </Field>
          </>
        )}

        {(node.type === "offer" || node.type === "files") && (
          <Field
            label="Продукт"
            hint={
              node.type === "offer"
                ? "Бот пришлёт карточку с кнопкой «Оплатить». Воронка сразу идёт дальше — добавьте паузу и условие «купил?», чтобы дожать."
                : "Бот отправит файлы продукта без оплаты — удобно для лид-магнита."
            }
          >
            <ProductSelect value={d.product_id} onChange={(v) => set({ product_id: v })} />
          </Field>
        )}

        {node.type === "condition" && (
          <>
            <Field label="Проверить">
              <select className={selectCls} value={d.kind ?? "purchased"} onChange={(e) => set({ kind: e.target.value })}>
                <option value="purchased">Купил продукт</option>
                <option value="has_tag">Есть тег</option>
                <option value="has_var">Ответил на вопрос</option>
                <option value="subscribed">Подписан на канал</option>
              </select>
            </Field>
            {d.kind === "subscribed" && (
              <ChannelField value={d.channel ?? ""} onChange={(channel) => set({ channel })} />
            )}
            {d.kind === "purchased" && <ProductSelect value={d.product_id} onChange={(v) => set({ product_id: v })} />}
            {d.kind === "has_tag" && (
              <Input placeholder="лид" maxLength={32} value={d.tag ?? ""} onChange={(e) => set({ tag: e.target.value })} />
            )}
            {d.kind === "has_var" && (
              <select className={selectCls} value={d.var ?? "email"} onChange={(e) => set({ var: e.target.value })}>
                {VAR_PRESETS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            )}
          </>
        )}

        {node.type === "tag" && (
          <>
            <Field label="Действие">
              <select className={selectCls} value={d.action ?? "add"} onChange={(e) => set({ action: e.target.value as "add" | "remove" })}>
                <option value="add">Поставить тег</option>
                <option value="remove">Снять тег</option>
              </select>
            </Field>
            <Field label="Тег" hint="Теги помогут потом сегментировать рассылки">
              <Input placeholder="лид" maxLength={32} value={d.tag ?? ""} onChange={(e) => set({ tag: e.target.value })} />
            </Field>
          </>
        )}

        <Field label="Название блока" hint="Необязательно — для вашего удобства на схеме">
          <Input value={d.title ?? ""} maxLength={60} placeholder={spec.label} onChange={(e) => set({ title: e.target.value })} />
        </Field>
      </div>

      {node.type !== "trigger" && (
        <div className="border-t border-black/[0.06] p-4">
          <button
            type="button"
            onClick={onDelete}
            className="flex w-full items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium text-red-600 hover:bg-red-50"
          >
            <Trash2 className="h-4 w-4" /> Удалить блок
          </button>
        </div>
      )}
    </div>
  );
}
