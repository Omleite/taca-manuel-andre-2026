# Atualizar Handicaps dos Jogadores

## Visão Geral

O script `Update-HCP.ps1` lê a **Listagem de Handicaps** exportada do DataGolf (PDF) e atualiza automaticamente no `data-backup.json`:
- **Nome** completo do jogador (conforme FPG)
- **handicapWhs** — índice WHS atualizado
- **handicap** — HCP de campo calculado pela fórmula oficial da Estela

---

## Passo 1 — Exportar o PDF do DataGolf

1. Entrar no DataGolf → **Listagens** → **Listagem de Handicaps**
2. Selecionar o clube **022 Estela**
3. Exportar / imprimir em **PDF**
4. Guardar o ficheiro em `C:\Downloads\ListagemHandicapsEstelaAtual.pdf`

---

## Passo 2 — Executar o Script

Abrir o **PowerShell** na pasta do projeto e executar:

### Pré-visualização (sem gravar)
```powershell
.\Update-HCP.ps1 -HcpFile "C:\Downloads\ListagemHandicapsEstelaAtual.pdf" -DryRun
```
Mostra todas as alterações que seriam feitas — **não altera nenhum ficheiro**.

### Aplicar as alterações
```powershell
.\Update-HCP.ps1 -HcpFile "C:\Downloads\ListagemHandicapsEstelaAtual.pdf"
```

> **Nota:** O script tenta localizar automaticamente o `pdftotext` (Poppler) em várias localizações do sistema. Se não o encontrar, usa um método de extração nativa do PDF sem necessidade de instalar nenhuma ferramenta adicional.

---

## Passo 3 — Sincronizar com o GitHub

Após validar as alterações no `data-backup.json`, sincronizar:

```powershell
.\sync-to-github.ps1
```

O site em GitHub Pages atualiza em 1–3 minutos.

---

## Parâmetros do Script

| Parâmetro | Obrigatório | Descrição |
|-----------|:-----------:|-----------|
| `-HcpFile` | ✅ | Caminho para o PDF ou TXT com os handicaps |
| `-JsonFile` | ❌ | Ficheiro JSON a atualizar (padrão: `data-backup.json`) |
| `-DryRun` | ❌ | Pré-visualiza alterações sem gravar |

### Aceita PDF e TXT

O script aceita dois formatos de entrada:

- **PDF** — Listagem de Handicaps exportada directamente do DataGolf *(recomendado)*
- **TXT** — Ficheiro intermédio com formato `NFederado | Nome | HCP`

---

## Fórmula HCP de Campo (Estela Golf Club)

```
HCP Campo = Round(WHS × SR/113 + (CR − Par))   [máximo 36]
```

| Tee | Course Rating (CR) | Slope Rating (SR) | Par |
|-----|:-----------------:|:-----------------:|:---:|
| Amarelas (Homens) | 71,2 | 128 | 72 |
| Vermelhas (Senhoras) | 73,7 | 126 | 72 |

---

## Exemplo de Output

```
A ler Listagem Handicaps 20260804.pdf ...
  295 jogadores carregados.
A ler data-backup.json ...
  [AVISO] N 303 (Adelino Caldeira) nao encontrado no ficheiro HCP.

Alteracoes detetadas:
  [48972] WHS: 2.1 -> 1.8 | HCP Campo: 2 -> 1
  [58336] WHS: 20.5 -> 11.6 | HCP Campo: 22 -> 12
  [27971] WHS: 11 -> 10.7 | HCP Campo: 12 -> 11

Ficheiro data-backup.json atualizado com sucesso.

=== RESUMO ===
  Jogadores atualizados : 52
  Nao encontrados no HCP: 1
  Total no JSON          : 75
```

### Avisos `[AVISO]`

Jogadores no JSON cujo `numeroFederado` não existe no PDF. Causas habituais:
- Número de federado errado no JSON → corrigir manualmente
- Jogador não é sócio da Estela → ignorar (ex: *Adelino Caldeira*)

---

## Requisitos

- **Windows 10/11** com PowerShell 5.1+
- Acesso de escrita à pasta do projeto
- **Poppler** (`pdftotext`) opcional — se não estiver instalado, o script usa extração nativa do PDF

> O script procura o `pdftotext` automaticamente nos locais de instalação habituais (Program Files, WinGet, Chocolatey). Se não encontrar, extrai o texto diretamente do binário PDF sem dependências adicionais.
