// A daily's front-page picture comes from the item its lead is about: the editors' lead matched to an
// item by title, never simply the first highlight.
import "./setup.ts";
import assert from "node:assert/strict";
import { test } from "node:test";
import type { ReportCitation } from "@aihot/contracts/site";
import { leadItemOf } from "@aihot/backend/publication/reports";

const cite = (itemId: string, title: string, available = true) => ({ itemId, title, available }) as ReportCitation;
const arena = cite("a", "OEKO-TEX STANDARD 100 新版本↔抽查合格率位居榜首");
const openai = cite("b", "SGS 暂停部分新项目的受理，披露验厂报告模板被篡改及审核员资质失效等安全风险");

test("an editors' lead is matched to the item it is written about", () => {
  assert.equal(leadItemOf("SGS 暂停部分新项目受理，披露审核安全风险", [arena, openai], [arena, openai])?.itemId, "b");
});

test("a lead that matches no item clearly has no item", () => {
  assert.equal(leadItemOf("多家机构更新要求，行业解读增多", [arena], [arena, openai]), undefined);
});

test("without an editors' lead the first highlight leads", () => {
  assert.equal(leadItemOf(undefined, [arena], [openai, arena])?.itemId, "a");
});

test("a withdrawn highlight never leads the front page", () => {
  const withdrawn = cite("w", "已下架", false);
  assert.equal(leadItemOf(undefined, [withdrawn, arena], [withdrawn, arena, openai])?.itemId, "a");
});
