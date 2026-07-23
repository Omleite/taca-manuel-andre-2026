# 📋 Importação de Resultados via CSV (Segura com Match IDs)

## Como Usar

### 1. **Arquivo CSV: `Calendario_Resultados_IMPORT.csv`**
Este arquivo contém **todos os matches** com um ID único para cada um:

| Coluna | Descrição | Exemplo |
|--------|-----------|---------|
| `matchId` | **ID único do match** (formato: ronda-par-sequência) | `1-1-0`, `1-2-1`, `2-1-12` |
| `home` | Nome da equipa de casa *(referência visual, não editável)* | `Os 4 no Buraco` |
| `away` | Nome da equipa visitante *(referência visual, não editável)* | `Estela Birdies` |
| `result` | **[EDITÁVEL]** Resultado do match | `Vence A`, `Vence B`, `A/S` |
| `score` | **[EDITÁVEL]** Score em formato X&Y | `2&1` |

### 2. **O que Importa?**
A importação **APENAS atualiza `result` e `score`**. Os outros campos (matchId, home, away) são apenas para referência visual.

✅ **Seguro**: Usa ID único (não nome de equipa)  
✅ **Simples**: Só 2 colunas para preencher  
✅ **Previne erros**: Sem risco de confundir equipas ou corromper dados  

### 3. **Preenchimento**
A menina da receção deve preencher **apenas** as colunas `result` e `score`:

```csv
matchId,home,away,result,score
1-1-0,Os 4 no Buraco,Estela Birdies,Vence A,2&1
1-2-1,Os 4 no Buraco,Estela Birdies,A/S,1&1
1-1-2,Equipa Eleven,EMJC,Vence B,0&3
```

### 4. **Valores Válidos**

#### Resultado (`result`):
- `Vence A` — A equipa de casa (home) vence
- `Vence B` — A equipa visitante (away) vence  
- `A/S` — Empate (All Square)
- **Case-insensitive** (funciona: `vence a`, `VENCE A`)

#### Score (`score`):
- Formato: `X&Y` (ex: `2&1`, `1&0`, `3&2`)
- Opcional — se deixar em branco, só o resultado é registado

### 5. **Importação na App**

1. **Login como Admin** (username: `admin`, password: `estela2026`)
2. Ir para aba **"Configurações"** 
3. Descer até **"Importar Resultados (CSV)"**
4. Clicar em **"📤 Carregar CSV de Resultados"**
5. Selecionar o ficheiro preenchido
6. A app atualiza todos os resultados automaticamente

### 6. **Por que usar IDs?**

- **Segurança**: ID único previne confusão de equipas
- **Robustez**: Mudanças de nomes de equipas não afetam importação
- **Simplicidade**: Um ID é inequívoco
- **Referência Visual**: Ainda vê o nome das equipas para saber qual é o match

---

## 📝 Exemplo Completo

```csv
"matchId","home","away","result","score"
"1-1-0","Os 4 no Buraco","Estela Birdies","Vence A","2&1"
"1-2-1","Os 4 no Buraco","Estela Birdies","A/S","1&1"
"1-1-2","Equipa Eleven","EMJC","Vence B","0&3"
"1-2-3","Equipa Eleven","EMJC","Vence A","2&1"
```

---

## ⚠️ Notas Importantes

- ✅ **Segurança**: Apenas atualiza `result` e `score` — dados do match nunca são alterados
- ✅ **Sem Risco**: Usa ID único, não nome de equipa
- ✅ **Admin Only**: Apenas com permissões de administrador
- ⚠️ **Não remova linhas**: Use sempre o CSV original completo

---

## 🔧 Troubleshooting

**P: "CSV não tem a coluna obrigatória: matchId"**
> A: Verifique que tem exatamente: `matchId, home, away, result, score`

**P: "Alguns resultados não foram importados / X erros"**
> A: Verifique:
> - `matchId` está correto (ex: `1-1-0`)
> - Não removeu/adicionou linhas
> - `result` é `Vence A`, `Vence B` ou `A/S`
> - `score` é formato `X&Y` (ex: `2&1`)
