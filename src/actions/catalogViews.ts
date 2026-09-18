'use server';

import { revalidatePath } from 'next/cache';
import { requireHouseAccess } from '../lib/auth-guard';
import { CATALOG_KINDS, CATALOG_SORT_KEYS, type CatalogSortDir, type CatalogSortKey } from '../types';
import { prisma } from '../lib/prisma';
import * as v from '../lib/validation';

const SORT_DIRS = ['asc', 'desc'] as const satisfies readonly CatalogSortDir[];

export interface CatalogTableViewInput {
  id: string;
  name: string;
  kindIds: string[];
  accountIds: string[];
  labelIds: string[];
  sortKey: CatalogSortKey;
  sortDir: CatalogSortDir;
}

function viewFields(view: CatalogTableViewInput) {
  return {
    name: v.text(view.name, 'name'),
    kindIds: v.idList(view.kindIds, 'kindIds').map((kind) => v.enumValue(kind, CATALOG_KINDS, 'kindIds')),
    accountIds: v.idList(view.accountIds, 'accountIds'),
    labelIds: v.idList(view.labelIds, 'labelIds'),
    sortKey: v.enumValue(view.sortKey, CATALOG_SORT_KEYS, 'sortKey'),
    sortDir: v.enumValue(view.sortDir, SORT_DIRS, 'sortDir'),
  };
}

export async function createCatalogTableView(
  houseId: string,
  view: CatalogTableViewInput
): Promise<void> {
  const { houseId: scopedHouseId } = await requireHouseAccess(houseId);
  const { _max } = await prisma.catalogTableView.aggregate({
    where: { houseId: scopedHouseId },
    _max: { position: true },
  });

  await prisma.catalogTableView.create({
    data: {
      id: v.id(view.id, 'id'),
      houseId: scopedHouseId,
      position: (_max.position ?? -1) + 1,
      ...viewFields(view),
    },
  });

  revalidatePath('/');
}

export async function updateCatalogTableView(
  houseId: string,
  viewId: string,
  patch: { name: string }
): Promise<void> {
  const { houseId: scopedHouseId } = await requireHouseAccess(houseId);

  await prisma.catalogTableView.updateMany({
    where: { id: v.id(viewId, 'viewId'), houseId: scopedHouseId },
    data: { name: v.text(patch.name, 'name') },
  });

  revalidatePath('/');
}

export async function deleteCatalogTableView(houseId: string, viewId: string): Promise<void> {
  const { houseId: scopedHouseId } = await requireHouseAccess(houseId);

  await prisma.catalogTableView.deleteMany({
    where: { id: v.id(viewId, 'viewId'), houseId: scopedHouseId },
  });

  revalidatePath('/');
}
