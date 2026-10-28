# 🏙️ Cifrópolis — Do Zero ao Império

Simulador de magnata (*tycoon*) **idle/clicker** para **Android**, em retrato e para jogar com uma mão.
Comece tocando na moeda sem um centavo, arrume um emprego, abra negócios, contrate gerentes, invista na bolsa,
em cripto e em imóveis, colecione carros, iates, jatos, relógios e arte, dispute o torneio semanal e funde seu **Legado**.

- 100% offline · save automático no aparelho · ganhos offline (até 4 h, ampliáveis)
- Sem anúncios forçados · nesta versão não há anúncios nem compras (bônus gratuitos com recarga)
- Conquistas, missões diárias, desbloqueio progressivo, backups automáticos do save
- Mundo, nomes, logo e arte **originais**

| Documento | Conteúdo |
|---|---|
| [`docs/DESIGN.md`](docs/DESIGN.md) | Visão, público, loop, sistemas, monetização, UX **e estrutura técnica / pastas** |
| [`docs/BALANCE.md`](docs/BALANCE.md) | Fórmulas e tabela de balanceamento das 2 primeiras horas |
| [`docs/ROADMAP.md`](docs/ROADMAP.md) | Próximos passos para expandir o jogo |

---

## ▶️ Jogar agora no navegador (sem instalar nada além do Node)

```bash
npx http-server www -p 8080 -c-1     # ou: npm run serve
```
Abra `http://localhost:8080` no Chrome. No PC, use o DevTools (F12 → ícone de celular) para simular uma tela de celular.

---

## 📦 Gerar o APK passo a passo

### 1. Pré-requisitos
| Ferramenta | Versão | Onde obter |
|---|---|---|
| Node.js | 20 ou superior | https://nodejs.org |
| JDK | 21 | https://adoptium.net (Temurin 21) |
| Android SDK | Platform 35 + Build-Tools 35 | Android Studio (mais fácil) **ou** apenas *command-line tools* |

**Opção A — Android Studio (recomendado):** instale o Android Studio; na primeira abertura ele baixa o SDK.
Em *SDK Manager* confira **Android 15 (API 35)** e **Build-Tools 35**.

**Opção B — só linha de comando (Linux/macOS):**
```bash
mkdir -p ~/android-sdk/cmdline-tools && cd ~/android-sdk
# baixe "Command line tools only" em https://developer.android.com/studio#command-tools
unzip commandlinetools-*.zip && mv cmdline-tools latest && mkdir cmdline-tools && mv latest cmdline-tools/
yes | cmdline-tools/latest/bin/sdkmanager "platform-tools" "platforms;android-35" "build-tools;35.0.0"
export ANDROID_HOME=~/android-sdk
```

### 2. Instalar dependências do projeto
```bash
cd IdleClicker
npm install
```

### 3. Informar onde está o SDK
Crie `android/local.properties` com o caminho do seu SDK:
```properties
# Windows:  sdk.dir=C\:\\Users\\SEU_USUARIO\\AppData\\Local\\Android\\Sdk
# macOS:    sdk.dir=/Users/SEU_USUARIO/Library/Android/sdk
sdk.dir=/home/SEU_USUARIO/android-sdk
```
(Ou apenas defina a variável de ambiente `ANDROID_HOME`.)

### 4. Copiar o jogo para o projeto Android e compilar
```bash
npx cap sync android
cd android
./gradlew assembleDebug          # Windows: gradlew.bat assembleDebug
```
O APK fica em **`android/app/build/outputs/apk/debug/app-debug.apk`**.
(Atalho: `npm run apk:debug` faz os dois passos.)

> **Dica:** se o Gradle falhar com `429 Too Many Requests` ao baixar dependências, espere alguns minutos e rode de novo.

### 5. Instalar no celular
- **Via cabo:** ative *Opções do desenvolvedor → Depuração USB* e rode `adb install -r app/build/outputs/apk/debug/app-debug.apk`.
- **Sem cabo:** envie o `.apk` para o celular, toque nele e permita *Instalar apps desconhecidos* para o gerenciador de arquivos.

### 6. (Opcional) APK/AAB de release assinado
```bash
keytool -genkey -v -keystore cifropolis.jks -alias cifropolis -keyalg RSA -keysize 2048 -validity 10000
```
Em `android/app/build.gradle`, adicione dentro de `android { }`:
```gradle
signingConfigs {
    release {
        storeFile file('../../cifropolis.jks')
        storePassword 'SUA_SENHA'
        keyAlias 'cifropolis'
        keyPassword 'SUA_SENHA'
    }
}
buildTypes { release { signingConfig signingConfigs.release } }
```
Depois: `./gradlew assembleRelease` (APK) ou `./gradlew bundleRelease` (AAB para a Play Store).
**Guarde a keystore**: sem ela não é possível atualizar o app publicado.

### Abrir no Android Studio
`npx cap open android` → *Run ▶* em um emulador ou aparelho.

---

## 🧪 Ferramentas

| Comando | O que faz |
|---|---|
| `npm run balance` | Simula 2 h de jogo com o código real e imprime a tabela de balanceamento |
| `npm test` | Testes unitários (Node, sem dependências): compras, upgrades, produção, funcionários, despesas, offline, relógio, Legado, missões, conquistas, save, importação maliciosa, formatação |
| `npm run test:e2e` | Teste de ponta a ponta no Chromium com tela de celular (36 verificações) — requer `npm i -D playwright && npx playwright install chromium` |
| `node tools/balance-sim.js 480 3 prestige` | Simula 8 h com Legado e aborta se encontrar NaN/Infinity/saldo negativo |
| `node tools/gen-icons.js` | Regenera ícones e splash do Android a partir de `www/assets/icon.svg` |

## 🗂️ Estrutura

```
www/            jogo (HTML/CSS/JS puro — é isso que vai no APK)
  js/data.js    conteúdo e números de balanceamento (edite aqui)
  js/economy.js fórmulas · js/game.js regras/save/offline · js/market.js bolsa/torneio
  js/ui.js      interface · js/ads.js anúncios/compra (stubs) · js/tutorial.js · js/main.js boot
android/        projeto nativo Capacitor (Gradle)
tools/          simulador de balanceamento, teste automatizado, gerador de ícones
docs/           design, balanceamento, roadmap
```

## 💸 Sobre anúncios e compras nesta versão
Nenhum SDK de anúncios ou de pagamentos está integrado, então **o jogo não mostra anúncios e não vende nada** —
e também não finge: não há tela de anúncio simulada nem compra simulada. Os bônus (Turbo x2 e Lucro rápido) são
gratuitos, com tempo de recarga. Para integrar AdMob/Google Play Billing, registre provedores reais em
`www/js/ads.js` (`AdService.setProvider` / `Store.setProvider`); veja `docs/ROADMAP.md`.

## 💾 Save e backups
O progresso fica no aparelho (salvo a cada 10 s e ao sair). Todo save carregado ou importado é validado campo a campo.
Se o save principal se corromper, o backup automático é restaurado e a cópia danificada é guardada.
Em **Mais › Ajustes** dá para exportar/importar (com confirmação) e restaurar backups locais.
