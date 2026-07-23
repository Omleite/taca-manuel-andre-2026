# 📋 Importação de Resultados via CSV

## Como Usar

### 1. **Arquivo CSV: `Calendario_Resultados_IMPORT.csv`**
Este arquivo contém **todos os matches** com as seguintes colunas:

| Coluna | Descrição | Exemplo |
|--------|-----------|---------|
| `ronda` | Número da jornada (1-5 grupo, 6-8 eliminatorias) | `1` |
| `par` | Número do par (1 ou 2) | `1` |
| `home` | Nome da equipa de casa | `Os 4 no Buraco` |
| `away` | Nome da equipa visitante | `Estela Birdies` |
| `result` | Resultado do match | `Vence A`, `Vence B`, `A/S` |
| `score` | Score em formato X&Y | `2&1` |

### 2. **Preenchimento**
A menina da receção deve preencher **apenas** as colunas `result` e `score`:

```
ronda,par,home,away,result,score
1,1,Os 4 no Buraco,Estela Birdies,Vence A,2&1
1,2,Os 4 no Buraco,Estela Birdies,A/S,1&1
```

### 3. **Valores Válidos**

#### Resultado (`result`):
- `Vence A` — A equipa de casa (home) vence
- `Vence B` — A equipa visitante (away) vence  
- `A/S` — Empate (All Square)

#### Score (`score`):
- Formato: `X&Y` (ex: `2&1`, `1&0`, `3&2`)
- Opcional — se deixar em branco, só o resultado é registado

### 4. **Importação na App**

1. **Login como Admin** (username: `admin`, password: `estela2026`)
2. Ir para aba **"Configurações"** 
3. Descer até **"Importar Resultados (CSV)"**
4. Clicar em **"📤 Carregar CSV de Resultados"**
5. Selecionar o ficheiro `Calendario_Resultados_IMPORT.csv` preenchido
6. A app vai processar e atualizar todos os resultados automaticamente

### 5. **Validação**
- ✅ O ficheiro deve ter exatamente 6 colunas: `ronda, par, home, away, result, score`
- ✅ A coluna `result` só aceita: `Vence A`, `Vence B`, `A/S` (case-insensitive)
- ✅ A coluna `score` deve estar em formato `X&Y` (ex: `1&0`)
- ✅ Linhas com erros serão puladas, mas a importação continua

### 6. **Resultado**
Após a importação, receberá uma mensagem:
- ✅ `Importados X resultados com sucesso!`
- ⚠️ `Importados X resultados (Y erros)` — alguns registos não foram válidos

---

## 📝 Exemplo Completo

```csv
"ronda","par","home","away","result","score"
"1","1","Os 4 no Buraco","Estela Birdies","Vence A","2&1"
"1","2","Os 4 no Buraco","Estela Birdies","A/S","1&1"
"1","1","Equipa Eleven","EMJC","Vence B","0&3"
"1","2","Equipa Eleven","EMJC","Vence A","2&1"
"2","1","Os Craques","Os 4 no Buraco","A/S","1&1"
"2","2","Os Craques","Os 4 no Buraco","Vence A","3&0"
```

---

## ⚠️ Notas Importantes

- **Backup**: A app já guarda automaticamente os dados. Cada importação sobrescreve os resultados anteriores.
- **Validação**: Confirme que os nomes das equipas estão **exatamente iguais** aos que estão na app
- **Formato**: O ficheiro deve ser UTF-8 ou ANSI (Excel standard)
- **Segurança**: Apenas utilizadores com role de Admin podem importar resultados

---

## 🔧 Troubleshooting

**P: "CSV não tem as colunas obrigatórias"**
> A: Verifique que o ficheiro tem exatamente estas colunas (case-insensitive): `ronda`, `par`, `home`, `away`, `result`, `score`

**P: "Alguns resultados não foram importados"**
> A: Verifique:
> - Nomes das equipas escritos corretamente
> - Valores em `result` são `Vence A`, `Vence B` ou `A/S`
> - `score` está em formato `X&Y` (ex: `2&1`)

**P: "Como saber quais linhas tiveram erro?"**
> A: Por enquanto, a app mostra apenas o total. Para debug, abra a consola do browser (F12 → Console) após a importação.
