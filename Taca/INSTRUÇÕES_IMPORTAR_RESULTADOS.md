# Importar Resultados via Excel → CSV

## Passo 1 — Abrir o Excel

Abrir o ficheiro **`Calendario_Resultados_IMPORT.xlsx`**.

> Se o ficheiro não existir ou estiver corrompido, regenerar com:
> ```powershell
> .\CreateExcel.ps1
> ```

---

## Passo 2 — Preencher os Resultados

O Excel tem 72 jogos ordenados por **Ronda → Grupo → Equipa → Par**.

| Coluna | Campo | Editar? |
|--------|-------|---------|
| A | matchId | ❌ Não editar |
| B | Ronda | ❌ Não editar |
| C | Par | ❌ Não editar |
| D | Equipa Casa | ❌ Não editar |
| E | Equipa Fora | ❌ Não editar |
| **F** | **Resultado** | ✅ **Preencher** |
| **G** | **Score (X&Y)** | ✅ **Preencher** |

### Coluna F — Resultado (dropdown)
| Valor | Significado |
|-------|-------------|
| `Vence A` | Equipa Casa vence |
| `Vence B` | Equipa Fora vence |
| `A/S` | Empate (All Square) |

### Coluna G — Score X&Y (dropdown)
| Valor | Significado |
|-------|-------------|
| `0` | Não jogado / empate sem score |
| `1&0` | 1 acima, chegou ao buraco 18 |
| `2&1` | 2 acima com 1 a jogar |
| `3&1` | 3 acima com 1 a jogar |
| `3&2` | 3 acima com 2 a jogar |
| ... | *(todos os scores válidos de match play)* |
| `10&8` | 10 acima com 8 a jogar (máximo) |

> **Dica:** Clicar na célula da coluna F ou G para ver a seta do dropdown.

---

## Passo 3 — Exportar para CSV

**Fechar o Excel** antes de exportar.

No terminal PowerShell, executar:
```powershell
.\Export-CSVDoExcel.ps1
```

Isto gera o ficheiro **`Calendario_Resultados_IMPORT.csv`** com as colunas:
```
"matchId","result","score"
```

---

## Passo 4 — Importar na App

1. Abrir a aplicação
2. Clicar em **⚙ Admin** (canto superior direito)
3. Ir a **Configurações**
4. Clicar em **Importar Resultados (CSV)**
5. Selecionar o ficheiro `Calendario_Resultados_IMPORT.csv`
6. Confirmar a importação

Os resultados ficam imediatamente visíveis na classificação.

---

## Notas

- Pode preencher apenas alguns jogos e importar parcialmente — os restantes ficam sem resultado.
- Pode reimportar várias vezes — os resultados existentes são sobrescritos.
- Jogos sem resultado (colunas F e G vazias) são ignorados na exportação.
- Se a ordenação do Excel não corresponder ao esperado, regenerar com `.\CreateExcel.ps1`.
