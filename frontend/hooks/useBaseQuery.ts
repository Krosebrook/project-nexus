import { useQuery, useMutation, useQueryClient, type UseQueryOptions, type UseMutationOptions } from "@tanstack/react-query";
import { useToast } from "@/components/ui/use-toast";

export interface BaseQueryConfig<TData> extends Omit<UseQueryOptions<TData>, "queryKey" | "queryFn"> {
  showErrorToast?: boolean;
  errorMessage?: string;
}

export interface BaseMutationConfig<TData, TVariables> {
  showSuccessToast?: boolean;
  showErrorToast?: boolean;
  successMessage?: string;
  errorMessage?: string;
  invalidateQueries?: string[][];
  onSuccess?: (data: TData, variables: TVariables, context: unknown) => void;
  onError?: (error: Error, variables: TVariables, context: unknown) => void;
}

export function useBaseQuery<TData>(
  queryKey: string[],
  queryFn: () => Promise<TData>,
  config?: BaseQueryConfig<TData>
) {
  const { showErrorToast = true, errorMessage, ...queryOptions } = config || {};

  return useQuery({
    queryKey,
    queryFn,
    ...queryOptions,
  } as any);
}

export function useBaseMutation<TData, TVariables = void>(
  mutationFn: (variables: TVariables) => Promise<TData>,
  config?: BaseMutationConfig<TData, TVariables>
) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const {
    showSuccessToast = true,
    showErrorToast = true,
    successMessage,
    errorMessage,
    invalidateQueries = [],
    ...mutationOptions
  } = config || {};

  return useMutation({
    mutationFn,
    onSuccess: (data: TData, variables: TVariables, context: unknown) => {
      if (showSuccessToast && successMessage) {
        toast({
          title: "Success",
          description: successMessage,
        });
      }

      invalidateQueries.forEach((queryKey) => {
        queryClient.invalidateQueries({ queryKey });
      });

      config?.onSuccess?.(data, variables, context);
    },
    onError: (error: Error, variables: TVariables, context: unknown) => {
      if (showErrorToast) {
        toast({
          variant: "destructive",
          title: "Error",
          description: errorMessage || error.message,
        });
      }
      console.error(error);
      config?.onError?.(error, variables, context);
    },
  } as any);
}

export interface CRUDConfig<TEntity, TCreateInput, TUpdateInput> {
  queryKey: string[];
  listFn: () => Promise<TEntity[]>;
  getFn: (id: number) => Promise<TEntity>;
  createFn?: (data: TCreateInput) => Promise<TEntity>;
  updateFn?: (data: TUpdateInput & { id: number }) => Promise<TEntity>;
  deleteFn?: (id: number) => Promise<void>;
  entityName?: string;
}

export function useBaseCRUD<TEntity, TCreateInput = any, TUpdateInput = any>(
  config: CRUDConfig<TEntity, TCreateInput, TUpdateInput>
) {
  const { queryKey, listFn, getFn, createFn, updateFn, deleteFn, entityName = "Item" } = config;

  const listQuery = useBaseQuery(queryKey, listFn, {
    staleTime: 30000,
  });

  const getQuery = (id: number) =>
    useBaseQuery([...queryKey, String(id)], () => getFn(id), {
      enabled: !!id,
    });

  const createMutation = createFn
    ? useBaseMutation(createFn, {
        successMessage: `${entityName} created successfully`,
        invalidateQueries: [queryKey],
      })
    : undefined;

  const updateMutation = updateFn
    ? useBaseMutation(updateFn, {
        successMessage: `${entityName} updated successfully`,
        invalidateQueries: [queryKey],
      })
    : undefined;

  const deleteMutation = deleteFn
    ? useBaseMutation(deleteFn, {
        successMessage: `${entityName} deleted successfully`,
        invalidateQueries: [queryKey],
      })
    : undefined;

  return {
    list: listQuery,
    get: getQuery,
    create: createMutation,
    update: updateMutation,
    delete: deleteMutation,
  };
}
