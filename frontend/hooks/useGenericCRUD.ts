import { useQuery, useMutation, useQueryClient, UseQueryOptions, UseMutationOptions } from "@tanstack/react-query";

export interface GenericCRUDOptions<T, TCreate, TUpdate, TId = number> {
  queryKey: string[];
  listFn: () => Promise<T[]>;
  getFn?: (id: TId) => Promise<T>;
  createFn?: (data: TCreate) => Promise<T>;
  updateFn?: (data: TUpdate & { id: TId }) => Promise<T>;
  deleteFn?: (id: TId) => Promise<void>;
}

export function useGenericList<T>(
  queryKey: string[],
  listFn: () => Promise<T[]>,
  options?: Omit<UseQueryOptions<T[], Error>, "queryKey" | "queryFn">
) {
  return useQuery({
    queryKey,
    queryFn: listFn,
    ...options,
  });
}

export function useGenericGet<T, TId = number>(
  queryKey: string[],
  id: TId | undefined,
  getFn: (id: TId) => Promise<T>,
  options?: Omit<UseQueryOptions<T, Error>, "queryKey" | "queryFn" | "enabled">
) {
  return useQuery({
    queryKey: [...queryKey, id],
    queryFn: () => getFn(id!),
    enabled: !!id,
    ...options,
  });
}

export function useGenericCreate<T, TCreate>(
  queryKey: string[],
  createFn: (data: TCreate) => Promise<T>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });
}

export function useGenericUpdate<T, TUpdate, TId = number>(
  queryKey: string[],
  updateFn: (data: TUpdate & { id: TId }) => Promise<T>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateFn,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: [...queryKey, variables.id] });
    },
  });
}

export function useGenericDelete<TId = number>(
  queryKey: string[],
  deleteFn: (id: TId) => Promise<void>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });
}

export function useGenericCRUD<T, TCreate = Partial<T>, TUpdate = Partial<T>, TId = number>(
  options: GenericCRUDOptions<T, TCreate, TUpdate, TId>
) {
  const list = useGenericList(options.queryKey, options.listFn);

  const get = (id: TId) =>
    useGenericGet<T, TId>(options.queryKey, id, options.getFn!);

  const create = options.createFn
    ? useGenericCreate(options.queryKey, options.createFn)
    : undefined;

  const update = options.updateFn
    ? useGenericUpdate<T, TUpdate, TId>(options.queryKey, options.updateFn)
    : undefined;

  const deleteMutation = options.deleteFn
    ? useGenericDelete<TId>(options.queryKey, options.deleteFn)
    : undefined;

  return {
    list,
    get,
    create,
    update,
    delete: deleteMutation,
  };
}
