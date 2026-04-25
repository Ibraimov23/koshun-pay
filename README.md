# 🏔️ Koshun PAY
**Trustless Tourism Ecosystem for Kyrgyzstan** *Децентрализованный маркетплейс активного отдыха на базе смарт-контрактов и AI.*

---

### 🚀 Key Value
* **Smart Escrow:** Средства туриста блокируются в смарт-контракте. Гид получает оплату только после фактического завершения тура. Безопасность без посредников.
* **Multi-Role UI:** Динамический интерфейс, адаптирующийся под роль: 
    * **Tourist** (поиск, консультация AI, покупка)
    * **Guide** (управление активными турами, вывод средств)
    * **GOS** (мониторинг системы и налоговые отчисления)
* **AI Guide (GPT-4o):** Интеллектуальный ассистент, интегрированный в интерфейс. Помогает с выбором экипировки, оценкой сложности маршрута и вопросами безопасности.
* **On-chain Transparency:** Полная прослеживаемость транзакций, верификация статусов и распределение средств в сети **Sepolia**.

---

### 🛠 Tech Stack
* **Blockchain:** Solidity (Smart Contracts), Ethers.js
* **Frontend:** Next.js 14 (App Router), Tailwind CSS, Framer Motion
* **Intelligence:** OpenAI API (GPT-4o)
* **UX/UI:** MetaMask Integration, Apple-style design (32px rounding)

---

### 🏗 Workflow
1.  **Selection:** Поиск и подбор тура через диалог с AI-консультантом.
2.  **Commit:** Оплата тура в `USDT/PYUSD` → Автоматическая блокировка средств в **Escrow**.
3.  **Proof of Service:** Проведение тура и подтверждение выполнения условий.
4.  **Settlement:** Смарт-контракт распределяет средства: выплата гиду + автоматический сбор комиссии системы.

---

### 📊 Project Status
- `Network:` Sepolia Testnet
- `Stage:` MVP Ready for Demo
- `Security:` Escrow-based protection enabled

---

© 2026 Koshun PAY Team. Построено на хакатоне для будущего туризма в Кыргызстане.
